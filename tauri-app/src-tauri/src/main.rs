// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::info;

#[tokio::main]
async fn main() {
    let port = async {
        let mut server = socks5::Server::new().await.expect("server to start");
        server.add_filter(|addr| {
            println!("OHH");

            info!("filtering request to {addr:?}");
            socks5::FilterResult::Allow
        });

        server.port()
    }
    .await;
    tauri::async_runtime::set(tokio::runtime::Handle::current());
    tauri_app_lib::run(port);
}
