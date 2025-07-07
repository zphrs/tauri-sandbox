use std::fmt::Display;

use super::error::Error;

#[derive(Debug, Clone, Copy)]
pub enum Cmd {
    Connect,
    Bind,
    UdpAssociate,
}

impl TryFrom<u8> for Cmd {
    type Error = Error;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0x01 => Ok(Cmd::Connect),
            0x02 => Ok(Cmd::Bind),
            0x03 => Ok(Cmd::UdpAssociate),
            _ => Err(Error::CmdNotSupported(Cmd::Connect)),
        }
    }
}

impl Display for Cmd {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let str = match self {
            Cmd::Connect => "Connect",
            Cmd::Bind => "Bind",
            Cmd::UdpAssociate => "UDP Associate",
        };
        f.write_str(str)
    }
}
