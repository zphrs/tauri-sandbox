pub mod subdomain;

use std::{collections::HashMap, fs, sync::Arc};

use log::info;
use tauri::{async_runtime::block_on, utils::config::{Csp, CspDirectiveSources}, Url};

#[derive(Default)]
struct SandboxPort(Arc<u16>);
// remember to call `.manage(MyState::default())`
#[tauri::command]
fn get_sandbox_url(state: tauri::State<'_, SandboxPort>) -> String {
    format!("http://localhost:{}", state.0)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let socks_port = block_on(async {
        let mut socks_server =
            socks5::Server::new().await.expect("server to start");
        socks_server.add_filter(|addr| {
            println!("OHH");

            info!("filtering request to {addr:?}");
            socks5::FilterResult::Allow
        });

        socks_server.port()
    });

    let sandbox_port = {
        let server = subdomain::Server::new();
        server.start();
        server.port()
    };
    let mut context = tauri::generate_context!();
    let init_policy = context
        .config()
        .app
        .security
        .csp
        .as_ref()
        .unwrap();
    info!("{init_policy}");
    let init_policy_str = init_policy.to_string();
    info!("init policy: {init_policy}");
    let old_policy = init_policy_str.split(";").map(str::trim).collect::<Vec<_>>();
    let mut policy = HashMap::new();
    for rule in old_policy {
        let mut split_rule = rule.split(" ");
        let key = split_rule.next().unwrap().to_string();
        let values = split_rule.map(String::from).collect::<Vec<String>>();

        policy.insert(key, CspDirectiveSources::List(values));
    }
    policy.entry("default-src".to_string()).or_insert(CspDirectiveSources::List(vec![])).push(format!("http://localhost:{sandbox_port}"));

    context.config_mut().app.security.csp = Some(Csp::DirectiveMap(policy.clone()));
    fs::write("/Users/zphrs/Library/Logs/com.plexigraph.app/lol.log", format!("{init_policy_str:?}\n{policy:#?}")).unwrap();

    // context.config_mut().app.security.csp = Some(Csp::Policy(new_csp.clone()));
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                  .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("logs".to_string()),
                    },
                ))
                .level(log::LevelFilter::Info).build()
        )
        
        .invoke_handler(tauri::generate_handler![get_sandbox_url])
        .manage(SandboxPort(sandbox_port.into()))
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let mut script_source = String::new();
            if std::env::consts::OS == "android" {
                script_source += r"
                try {

                    for (let i = 0; i < 500; i++) {
                        new RTCPeerConnection()
                    }
                } catch(err) {console.warn(err)}
                "
            }
            // works for everything *but* android. For android we run Fill500
            // in all documents immediately after they are created:
            // for (let i = 0; i < 500; i++) {
            //     new RTCPeerConnection()
            // }
            // This is because there is no way to run JS before a new document
            // is returned to the caller on android.
            // example exploitation which FILL500 mitigates for chromium browsers:
            // document.body.innerHTML += `<iframe id=a></iframe>`
            // new a.contentWindow.window.RTCPeerConnection()
            // note that we must Fill500 before any other content is injected
            // into the DOM. This is because iframes with the sandbox attribute
            // spawn their own process and thus the 500 RTC limit resets for them.
            // source & credit: https://delta.chat/en/2023-05-22-webxdc-security
            const REPLACEMENT_SRC: &str =
                r#"()=>{console.error("RTCPeerConnection not supported in a sandbox.")}"#;
            script_source += format!(
                r#"
            window.RTCPeerConnection = {REPLACEMENT_SRC};
            RTCPeerConnection = {REPLACEMENT_SRC};
            try {{
                window.webkitRTCPeerConnection = {REPLACEMENT_SRC};
                webkitRTCPeerConnection = {REPLACEMENT_SRC};
            }} catch (e){{}}
             console.debug("replaced RTCPeerConnection")
            "#,
            )
            .as_str();
            #[allow(unused_mut)]
            let mut window_builder = tauri::webview::WebviewWindowBuilder::new(
                app,
                "label",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .initialization_script_for_all_frames(script_source)
            .proxy_url(Url::parse(format!("socks5://127.0.0.1:{}", socks_port).as_str()).unwrap())
            .use_https_scheme(true)
            // default behavior; good to make explicit
            // .devtools(cfg!(debug_assertions));
            .devtools(true);
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            {
                window_builder = window_builder.allow_link_preview(false);
            }
            #[cfg(target_os = "macos")]
            {
                use tauri::TitleBarStyle;

                window_builder = window_builder.title_bar_style(TitleBarStyle::Transparent)
            }
            let _window = window_builder.build()?;
            Ok(())
        })
        .run(context)
        .expect("error while running tauri application");
}
