use tokio::{
    io::{self, AsyncWriteExt as _},
    net::TcpStream,
};

use crate::addr::Addr;

use super::Error;

struct Reply(u8);

impl From<Error> for Reply {
    fn from(value: Error) -> Self {
        Self(value.into())
    }
}

impl Reply {
    pub fn success() -> Self {
        Self(0x00)
    }
}

pub struct Response {
    reply: Reply,
    addr: Addr,
}

impl Response {
    pub fn from_error(error: Error) -> Self {
        Self {
            reply: error.into(),
            addr: Addr::Null,
        }
    }
    pub fn from_addr(addr: Addr) -> Self {
        Self {
            reply: Reply::success(),
            addr,
        }
    }
    pub async fn to_stream(
        &self,
        stream: &mut TcpStream,
    ) -> Result<(), io::Error> {
        stream.write_u8(0x05).await?; // version
        stream.write_u8(self.reply.0).await?; // reply
        stream.write_u8(0x00); // reserved
        self.addr.to_stream(stream);
        Ok(())
    }
}

impl From<Error> for Response {
    fn from(value: Error) -> Self {
        Self::from_error(value)
    }
}

impl From<Addr> for Response {
    fn from(value: Addr) -> Self {
        Self::from_addr(value)
    }
}
