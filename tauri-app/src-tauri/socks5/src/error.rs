use std::string::FromUtf8Error;

use thiserror::Error;
use tokio::io;

use super::cmd::Cmd;

#[derive(Error, Debug)]
pub enum Error {
    #[error("TCP error {0}")]
    Io(#[from] io::Error),
    #[error("error when parsing domain {0}")]
    InvalidDomain(String),
    #[error("invalid auth method")]
    InvalidAuth,
    #[error("version from client is not 5")]
    VersionMismatch,
    #[error("connection not allowed by ruleset")]
    BreaksRuleset,
    #[error("network unreachable")]
    NetworkUnreachable,
    #[error("host unreachable")]
    HostUnreachable,
    #[error("connection refused")]
    ConnectionRefused,
    #[error("TTL expired")]
    TtlExpired,
    #[error("unsupported command: {0}")]
    CmdNotSupported(Cmd),
    #[error("address type not supported")]
    AddressTypeNotSupported,
    #[error("internal error: {0}")]
    Internal(&'static str),
}

impl From<FromUtf8Error> for Error {
    fn from(_value: FromUtf8Error) -> Self {
        Error::InvalidDomain("<invalid-utf8>".to_string())
    }
}

impl Error {
    pub fn to_u8(&self) -> u8 {
        match self {
            Error::Io(_) => 0x01,
            Error::InvalidAuth => 0xFF,
            Error::VersionMismatch => 0x01,
            Error::BreaksRuleset => 0x02,
            Error::NetworkUnreachable => 0x03,
            Error::HostUnreachable => 0x04,
            Error::ConnectionRefused => 0x05,
            Error::TtlExpired => 0x06,
            Error::CmdNotSupported(_) => 0x07,
            Error::AddressTypeNotSupported => 0x08,
            Error::InvalidDomain(_) => 0x01,
            Error::Internal(_) => 0x01,
        }
    }
}

impl From<Error> for u8 {
    fn from(val: Error) -> u8 {
        val.to_u8()
    }
}
