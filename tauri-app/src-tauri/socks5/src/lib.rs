pub mod addr;
mod cmd;
pub mod error;
mod proxy;
mod request;
mod response;
pub mod server;

pub use addr::Addr;
use cmd::Cmd;
use error::Error;
use request::Request;

pub use server::FilterResult;
pub use server::Server;

#[cfg(test)]
mod tests {
    use log::{error, info};
    use pretty_env_logger;
    use tokio::task::JoinHandle;

    use crate::{
        FilterResult::{Allow, Deny},
        Server,
        error::Error,
    };

    fn setup_logger() {
        pretty_env_logger::init();
    }

    #[tokio::test]
    pub async fn server() -> Result<(), Error> {
        setup_logger();
        info!("starting server...");
        let mut s = Server::new().await?;
        info!("server now running at {}", s.addr());
        s.add_filter(|addr| {
            info!("Likely blocking request to {addr:?}");
            match addr {
                crate::Addr::Ip(_ip_addr, _) => Deny,
                crate::Addr::Domain(domain, _) => {
                    if domain == "webrtc.github.io" {
                        Allow
                    } else {
                        Deny
                    }
                }
                crate::Addr::Null => Deny,
            }
        });
        let mut jhs = Vec::<JoinHandle<()>>::new();
        loop {
            jhs.push(match s.poll().await {
                Ok(h) => h,
                Err(err) => {
                    error!("{err}");
                    continue;
                }
            });
        }
    }
}
