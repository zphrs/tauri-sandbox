use log::info;
use tokio::{
    io::{self, AsyncReadExt as _, AsyncWriteExt as _},
    net::{TcpListener, TcpStream},
};

use super::Error;
use super::Request;

pub struct Server {
    listener: TcpListener,
    tauri_port: u16,
}

impl Server {
    pub async fn new(tauri_port: u16) -> io::Result<Self> {
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        Ok(Self {
            listener,
            tauri_port,
        })
    }

    pub fn port(&self) -> u16 {
        let addr = self
            .listener
            .local_addr()
            .expect("listener to have an address");
        addr.port()
    }

    pub async fn poll(&self) -> Result<(), Error> {
        let Ok(stream) = self.listener.accept().await else {
            info!("Connection failed.");
            return Ok(());
        };
        self.accept(stream.0).await
    }

    pub async fn negotiate_auth(stream: &mut TcpStream) -> Result<(), Error> {
        let mut ver_method_ct = [0u8, 0u8];
        stream.read_exact(&mut ver_method_ct).await?;
        let [_ver, method_count] = ver_method_ct;
        let mut method_list = vec![0; method_count.into()];
        stream.read_exact(&mut method_list[..]).await?;

        let mut no_auth_found = false;
        for method in method_list {
            if method == 0x00 {
                no_auth_found = true
            }
        }
        if !no_auth_found {
            stream.write_all(&[0x05, 0xFF]).await?;
            // returning drops the stream, shuts it down
            return Err(Error::InvalidAuth);
        }

        // reply with version 0x05, protocol NO AUTHENTICATION REQUIRED
        stream.write_all(&[0x05, 0x00]).await?;

        Ok(())
    }

    pub async fn accept(&self, mut stream: TcpStream) -> Result<(), Error> {
        Self::negotiate_auth(&mut stream).await?;

        let req = Request::from_stream(&mut stream, self.tauri_port).await?;
        req.handle().await.to_stream(&mut stream).await?;
        Ok(())
    }
}
