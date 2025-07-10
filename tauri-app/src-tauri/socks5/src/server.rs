use std::net::SocketAddr;

use log::{info, trace};
use tokio::{
    io::{self, AsyncReadExt as _, AsyncWriteExt as _},
    net::{TcpListener, TcpStream},
    task::JoinHandle,
};

use crate::{addr::Addr, request::Filter};

use super::Error;
use super::Request;

pub struct Server<'a> {
    listener: TcpListener,
    filters: Vec<Box<Filter<'a>>>,
}

#[derive(PartialEq, Eq)]
pub enum FilterResult {
    Allow,
    Deny,
}

impl<'a> Server<'a> {
    /// get_forwarding_server should return the address
    pub async fn new() -> io::Result<Self> {
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        Ok(Self {
            filters: Vec::new(),
            listener,
        })
    }

    pub fn addr(&self) -> SocketAddr {
        self.listener
            .local_addr()
            .expect("listener to have an address")
    }

    pub fn port(&self) -> u16 {
        let addr = self
            .listener
            .local_addr()
            .expect("listener to have an address");
        addr.port()
    }

    pub async fn poll(&self) -> Result<JoinHandle<()>, Error> {
        let Ok(stream) = self.listener.accept().await else {
            info!("connection failed.");
            return Err(Error::Internal("connection failed"));
        };
        self.accept(stream.0).await
    }

    pub async fn negotiate_auth(stream: &mut TcpStream) -> Result<(), Error> {
        let _ver = stream.read_u8().await?;
        let method_ct = stream.read_u8().await?;
        let mut method_list = vec![0u8; method_ct.into()];
        stream.read_exact(&mut method_list[..]).await?;

        let mut no_auth_found = false;
        trace!("{} auths supported: {:02X?}", method_ct, method_list);
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

    /// By default all requests are passed through.
    /// If any filter returns false then the request will be blocked.
    pub fn add_filter<'b: 'a, F: Fn(&Addr) -> FilterResult + 'b>(
        &mut self,
        filter: F,
    ) {
        self.filters.push(Box::new(filter));
    }

    pub async fn accept(
        &self,
        mut stream: TcpStream,
    ) -> Result<JoinHandle<()>, Error> {
        Self::negotiate_auth(&mut stream).await?;

        let req = Request::from_stream(&mut stream, &self.filters).await?;
        req.handle(stream).await
    }
}
