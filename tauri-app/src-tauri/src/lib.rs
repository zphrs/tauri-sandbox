pub mod subdomain;

use std::sync::Arc;

use log::{info, trace};
use tauri::{http::Response, utils::config::Csp, Runtime, Url};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    info!("HERE");

    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[derive(Default)]
struct SandboxPort(Arc<u16>);
// remember to call `.manage(MyState::default())`
#[tauri::command]
fn get_sandbox_url(state: tauri::State<'_, SandboxPort>) -> String {
    format!("http://localhost:{}", state.0)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(socks_port: u16, sandbox_port: u16) {
    let mut context = tauri::generate_context!();
    let init_policy = context.config().app.security.csp.as_ref().unwrap();
    let old_policy = init_policy.to_string();
    context.config_mut().app.security.csp = Some(Csp::Policy(format!(
        "{old_policy} frame-src http://localhost:{sandbox_port};"
    )));
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
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
            .devtools(cfg!(debug_assertions));
            // .devtools(true);
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
