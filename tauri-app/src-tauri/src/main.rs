// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::info;
use tauri_app_lib::subdomain;

#[tokio::main]
async fn main() {
    let socks_port = async {
        let mut socks_server =
            socks5::Server::new().await.expect("server to start");
        socks_server.add_filter(|addr| {
            println!("OHH");

            info!("filtering request to {addr:?}");
            socks5::FilterResult::Allow
        });

        socks_server.port()
    }
    .await;
    let sandbox_port = {
        let server = subdomain::Server::new();
        server.start();
        server.port()
    };
    tauri::async_runtime::set(tokio::runtime::Handle::current());
    tauri_app_lib::run(socks_port, sandbox_port);
}
