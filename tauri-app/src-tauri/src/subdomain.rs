use std::{io::Cursor, sync::Arc, thread};

use log::warn;
use tauri::http::{StatusCode, Uri};
use tiny_http::{self, Header, Request, Response};

pub struct Server {
    port: u16,
    inner: Arc<tiny_http::Server>,
}

impl Server {
    pub fn new() -> Server {
        let server = tiny_http::Server::http(format!("localhost:0"))
            .expect("Unable to spawn server");
        let port = server.server_addr().to_ip().unwrap().port();
        Self {
            inner: server.into(),
            port,
        }
    }

    fn create_response(port: u16, req: &Request) -> Response<Cursor<Vec<u8>>> {
        let Ok(uri) = req.url().parse::<Uri>() else {
            return Response::from_string("invalid uri")
                .with_status_code(StatusCode::BAD_REQUEST.as_u16());
        };
        let mut path_parts = uri.path()[1..].split('/');
        let [id, trailing_slash, ..] =
            [path_parts.next(), path_parts.next(), path_parts.next()];
        match uri {
            _ if uri.path() == "/sw.js" => {
                const SUBDOMAIN_SW: &str =
                    include_str!("../../subdomain/dist/sw.js");
                Response::from_data(SUBDOMAIN_SW.as_bytes()).with_header(
                    Header::from_bytes(
                        "Content-Type",
                        "text/javascript; charset=UTF-8",
                    )
                    .unwrap(),
                )
            }
            _ if id.is_some() && [None, Some("")].contains(&trailing_slash) => {
                const SUBDOMAIN_HTML: &str =
                    include_str!("../../subdomain/dist/index.html");
                Response::from_data(
                    SUBDOMAIN_HTML
                        .replace("%MY_PORT%", port.to_string().as_str())
                        .as_bytes(),
                )
                .with_header(
                    Header::from_bytes(
                        "Content-Type",
                        "text/html; charset=UTF-8",
                    )
                    .unwrap(),
                )
            }
            _ => Response::from_string("Not Found")
                .with_status_code(StatusCode::NOT_FOUND.as_u16()),
        }
    }

    pub fn start(&self) {
        let server = self.inner.clone();
        let port = self.port;
        thread::spawn(move || loop {
            let req = match server.recv() {
                Ok(rq) => rq,
                Err(e) => {
                    println!("error on receiving server request: {}", e);
                    break;
                }
            };
            let res = Self::create_response(port, &req);
            if let Err(e) = req.respond(res) {
                warn!("error while responding to sandbox request: {}", e)
            }
        });
    }

    pub fn port(&self) -> u16 {
        self.port
    }
}
