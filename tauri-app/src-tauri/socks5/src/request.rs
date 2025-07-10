use log::trace;
use tokio::io::AsyncReadExt as _;
use tokio::net::TcpStream;
use tokio::task::JoinHandle;

use crate::proxy::Proxy;
use crate::response::Response;
use crate::server::FilterResult;

use super::Addr;
use super::Cmd;
use super::Error;

pub type Filter<'a> = dyn Fn(&Addr) -> FilterResult + 'a;

pub struct Request<'a> {
    cmd: Cmd,
    addr: Addr,
    filters: &'a Vec<Box<Filter<'a>>>,
}

impl<'a> Request<'a> {
    pub async fn from_stream(
        stream: &mut TcpStream,
        filters: &'a Vec<Box<Filter<'a>>>,
    ) -> Result<Self, Error> {
        let ver = stream.read_u8().await?;
        if ver != 0x05 {
            return Err(Error::VersionMismatch);
        }
        let cmd: Cmd = stream.read_u8().await?.try_into()?;
        let _rsv = stream.read_u8().await?;
        let addr = Addr::from_stream(stream).await?;
        Ok(Self { cmd, addr, filters })
    }

    async fn handle_inner(
        &self,
        stream: TcpStream,
    ) -> Result<JoinHandle<()>, (Error, TcpStream)> {
        match self.cmd {
            Cmd::Connect => (),
            Cmd::UdpAssociate => {
                
            }
            cmd => {
                return Err((Error::CmdNotSupported(cmd), stream));
            }
        }
        trace!("Handling request to connect to {0:?}", self.addr);
        for filter in self.filters.iter() {
            if filter(&self.addr) == FilterResult::Deny {
                return Err((Error::BreaksRuleset, stream));
            }
        }

        let Proxy { handle } =
            match Proxy::run_tcp(self.addr.clone(), stream).await {
                Ok(proxy) => proxy,
                Err(e) => return Err((e.0, e.1)),
            };
        Ok(handle)
    }
    pub async fn handle(
        &self,
        stream: TcpStream,
    ) -> Result<JoinHandle<()>, Error> {
        match self.handle_inner(stream).await {
            Ok(v) => return Ok(v),
            Err((e, mut stream)) => {
                Response::from_error(&e).to_stream(&mut stream).await?;
                Err(e)
            }
        }
    }
}
