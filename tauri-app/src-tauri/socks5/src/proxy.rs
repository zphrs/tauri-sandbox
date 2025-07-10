use std::{net::SocketAddr, time::Duration};

use log::{debug, error};
use tokio::{
    io::{AsyncRead, AsyncWrite},
    net::TcpStream,
    task::JoinHandle,
    time::{sleep, timeout},
};

use crate::{Addr, Error, response::Response};

pub struct Proxy {
    pub handle: JoinHandle<()>,
}

pub struct ProxyError(pub Error, pub TcpStream);

impl<IE: Into<Error>> From<(IE, TcpStream)> for ProxyError {
    fn from(value: (IE, TcpStream)) -> Self {
        ProxyError(value.0.into(), value.1)
    }
}

impl Proxy {
    pub async fn run_tcp(
        target_addr: Addr,
        mut client_stream: TcpStream,
    ) -> Result<Self, ProxyError> {
        let addr: SocketAddr = match TryInto::<SocketAddr>::try_into(
            match target_addr.resolve_dns().await {
                Ok(v) => v,
                Err(e) => return Err(ProxyError(e, client_stream)),
            },
        ) {
            Ok(addr) => addr,
            Err(e) => return Err(ProxyError(e, client_stream)),
        };
        let outgoing_stream =
            match match timeout(Duration::new(30, 0), TcpStream::connect(addr))
                .await
                .map_err(|_| {
                    Error::Internal("timed out on connecting to proxy address")
                }) {
                Ok(v) => v,
                Err(e) => return Err((e, client_stream).into()),
            } {
                Ok(v) => v,
                Err(e) => return Err((e, client_stream).into()),
            };
        let local_addr = match outgoing_stream.local_addr() {
            Ok(v) => v,
            Err(e) => return Err((e, client_stream).into()),
        };
        let external_addr =
            Addr::from_ip_addr(local_addr.ip(), local_addr.port());
        let res = Response::from_addr(external_addr);
        if let Err(e) = res.to_stream(&mut client_stream).await {
            return Err((e, client_stream).into());
        };
        let handle =
            tokio::spawn(Self::transfer(outgoing_stream, client_stream));
        let aborter = handle.abort_handle();
        tokio::spawn(async move {
            sleep(Duration::new(60, 0)).await;
            aborter.abort();
        });
        Ok(Self { handle })
    }
    async fn transfer<A, B>(mut a: A, mut b: B)
    where
        A: AsyncRead + AsyncWrite + Unpin,
        B: AsyncRead + AsyncWrite + Unpin,
    {
        match tokio::io::copy_bidirectional(&mut a, &mut b).await {
            Ok(res) => debug!("transfer closed ({}, {})", res.0, res.1),
            Err(err) => error!("transfer error: {:?}", err),
        };
    }
}
