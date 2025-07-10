use std::net::{IpAddr, Ipv4Addr, SocketAddr};

use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpStream, lookup_host},
};

use super::error::Error;

#[derive(Debug, Clone)]
pub enum Addr {
    Ip(IpAddr, u16),
    Domain(String, u16),
    Null,
}

impl TryFrom<Addr> for SocketAddr {
    type Error = Error;

    fn try_from(value: Addr) -> Result<Self, Self::Error> {
        match value {
            Addr::Ip(ip_addr, port) => Ok(SocketAddr::new(ip_addr, port)),
            Addr::Domain(_, _) => Err(Error::Internal(
                "tried to convert an addr of type domain to a SocketAddr. Call resolve_dns first before calling the type conversion",
            )),
            Addr::Null => Err(Error::Internal(
                "tried to convert a null address to a SocketAddr.",
            )),
        }
    }
}

impl Addr {
    pub fn from_ip_addr(ip_addr: IpAddr, port: u16) -> Self {
        Self::Ip(ip_addr, port)
    }

    pub fn from_ipv4_addr(ip_addr: Ipv4Addr, port: u16) -> Self {
        Self::Ip(IpAddr::V4(ip_addr), port)
    }

    pub async fn from_ipv6_addr(
        ip_addr: std::net::Ipv6Addr,
        port: u16,
    ) -> Self {
        Self::Ip(IpAddr::V6(ip_addr), port)
    }

    pub async fn try_from_domain(
        domain: String,
        port: u16,
    ) -> Result<Self, Error> {
        if domain.len() > 253 {
            return Err(Error::InvalidDomain(domain));
        };
        Ok(Self::Domain(domain, port))
    }

    pub async fn from_stream(stream: &mut TcpStream) -> Result<Self, Error> {
        match stream.read_u8().await? {
            0x01 => Self::ipv4_from_stream(stream).await,
            0x03 => Self::domain_from_stream(stream).await,
            0x04 => Self::ipv6_from_stream(stream).await,
            _ => Err(Error::AddressTypeNotSupported),
        }
    }

    pub async fn ipv4_from_stream(
        stream: &mut TcpStream,
    ) -> Result<Self, Error> {
        let mut ipv4_bytes = [0u8; 4];
        stream.read_exact(&mut ipv4_bytes).await?;
        Ok(Self::Ip(
            IpAddr::V4(Ipv4Addr::from_bits(stream.read_u32().await?)),
            stream.read_u16().await?,
        ))
    }

    pub async fn ipv6_from_stream(
        stream: &mut TcpStream,
    ) -> Result<Self, Error> {
        Ok(Self::Ip(
            IpAddr::V6(std::net::Ipv6Addr::from_bits(
                stream.read_u128().await?,
            )),
            stream.read_u16().await?,
        ))
    }

    pub async fn domain_from_stream(
        stream: &mut TcpStream,
    ) -> Result<Self, Error> {
        let domain_len = stream.read_u8().await?;
        let mut domain_bytes = vec![0u8; domain_len as usize];
        stream.read_exact(&mut domain_bytes).await?;
        let domain = String::from_utf8(domain_bytes)?;
        if domain.len() > 253 {
            return Err(Error::InvalidDomain(domain));
        };
        let port = stream.read_u16().await?;
        Ok(Self::Domain(domain, port))
    }

    pub async fn to_stream(&self, stream: &mut TcpStream) -> Result<(), Error> {
        let port = match self {
            Addr::Ip(IpAddr::V4(v4), port) => {
                Self::write_v4(stream, v4).await?;
                *port
            }
            Addr::Domain(domain, port) => {
                Self::write_domain(stream, domain).await?;
                *port
            }
            Addr::Ip(IpAddr::V6(v6), port) => {
                Self::write_v6(stream, v6).await?;
                *port
            }
            Addr::Null => {
                Self::write_null(stream).await?;
                0x00
            }
        };
        stream.write_u16(port).await?;
        Ok(())
    }

    pub async fn resolve_dns(self) -> Result<Self, Error> {
        match self {
            Addr::Domain(domain, port) => {
                let addr = lookup_host((domain.as_str(), port))
                    .await?
                    .next()
                    .ok_or(Error::InvalidDomain(domain.clone()))?;
                Ok(Self::from_ip_addr(addr.ip(), port))
            }
            _ => Ok(self),
        }
    }

    async fn write_v6(
        stream: &mut TcpStream,
        v6: &std::net::Ipv6Addr,
    ) -> Result<(), Error> {
        stream.write_u8(0x04).await?;
        stream.write_u128(v6.to_bits()).await?;
        Ok(())
    }

    async fn write_domain(
        stream: &mut TcpStream,
        domain: &String,
    ) -> Result<(), Error> {
        stream.write_u8(0x03).await?;
        stream
            .write_u8(
                domain
                    .len()
                    .try_into()
                    .expect("domain length to be no more than 253"),
            )
            .await?;
        stream.write_all(domain.as_bytes()).await?;
        Ok(())
    }

    async fn write_v4(
        stream: &mut TcpStream,
        v4: &Ipv4Addr,
    ) -> Result<(), Error> {
        stream.write_u8(0x01).await?;
        stream.write_u32(v4.to_bits()).await?;
        Ok(())
    }

    async fn write_null(stream: &mut TcpStream) -> Result<(), Error> {
        stream.write_u8(0x00).await?;
        Ok(())
    }
}
