use std::net::Ipv4Addr;

use tokio::io::AsyncReadExt as _;
use tokio::net::TcpStream;

use crate::response::Response;

use super::Addr;
use super::Cmd;
use super::Error;

pub struct Request {
    cmd: Cmd,
    addr: Addr,
    tauri_port: u16,
}

impl Request {
    pub async fn from_stream(
        stream: &mut TcpStream,
        tauri_port: u16,
    ) -> Result<Self, Error> {
        let ver = stream.read_u8().await?;
        if ver != 0x05 {
            return Err(Error::VersionMismatch);
        }
        let cmd: Cmd = stream.read_u8().await?.try_into()?;
        let _rsv = stream.read_u8().await?;
        let addr = Addr::from_stream(stream).await?;
        Ok(Self {
            cmd,
            addr,
            tauri_port,
        })
    }

    pub async fn handle(&self) -> Response {
        match self.cmd {
            Cmd::Connect => (),
            cmd => {
                return Error::CmdNotSupported(cmd).into();
            }
        }
        let (addr, port) = match self.addr {
            Addr::Ip(std::net::IpAddr::V4(ip_addr), port) => (ip_addr, port),
            _ => return Error::BreaksRuleset.into(),
        };

        if addr.is_loopback() && port == self.tauri_port {
            return Response::from_addr(Addr::from_ipv4_addr(addr, port));
        }
        return Error::BreaksRuleset.into();
    }
}
