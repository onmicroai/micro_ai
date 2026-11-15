"""
Guards against server-side request forgery when fetching user-supplied URLs.

Two layers:
  * validate_public_url() rejects bad schemes and hosts that resolve to
    non-public addresses, so the user gets a clear error up front.
  * SafeHTTPAdapter re-checks the address at connect time and connects to the
    address it checked, so a host cannot pass validation and then resolve to
    an internal address for the real request (DNS rebinding).

This module has no Django dependency.
"""
from __future__ import annotations

import ipaddress
import socket
from typing import List
from urllib.parse import urlsplit, urlunsplit

from requests.adapters import HTTPAdapter
from urllib3.connection import HTTPConnection, HTTPSConnection
from urllib3.connectionpool import HTTPConnectionPool, HTTPSConnectionPool
from urllib3.exceptions import NewConnectionError
from urllib3.util import connection as urllib3_connection

ALLOWED_SCHEMES = ("http", "https")
ALLOWED_PORTS = (80, 443, 8080, 8443)
MAX_URL_LENGTH = 2048


class UnsafeURLError(ValueError):
    """The URL is malformed or points somewhere we refuse to fetch."""


def is_public_ip(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return False
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    # is_global excludes private, loopback, link-local (including the cloud
    # metadata address), carrier-grade NAT, reserved and unspecified ranges.
    return ip.is_global and not ip.is_multicast


def resolve_public_ips(host: str, port: int) -> List[str]:
    """Resolve host and return its addresses; raise if any is not public."""
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError):
        raise UnsafeURLError("This address could not be found. Check the URL and try again.")

    addresses = []
    for info in infos:
        address = info[4][0]
        if address not in addresses:
            addresses.append(address)
    if not addresses:
        raise UnsafeURLError("This address could not be found. Check the URL and try again.")
    if not all(is_public_ip(address) for address in addresses):
        raise UnsafeURLError("This address is not publicly reachable, so it cannot be added.")
    return addresses


def validate_public_url(url: str) -> str:
    """Return a normalised URL (no fragment), or raise UnsafeURLError."""
    url = (url or "").strip()
    if not url:
        raise UnsafeURLError("Enter a URL.")
    if len(url) > MAX_URL_LENGTH:
        raise UnsafeURLError("This URL is too long.")
    if "://" not in url:
        url = "https://" + url

    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError:
        raise UnsafeURLError("This does not look like a valid URL.")

    if parts.scheme.lower() not in ALLOWED_SCHEMES:
        raise UnsafeURLError("Only http and https URLs can be added.")
    if not parts.hostname:
        raise UnsafeURLError("This does not look like a valid URL.")
    if parts.username or parts.password:
        raise UnsafeURLError("URLs containing a username or password cannot be added.")

    scheme = parts.scheme.lower()
    effective_port = port or (443 if scheme == "https" else 80)
    if effective_port not in ALLOWED_PORTS:
        raise UnsafeURLError("This URL uses a port that is not allowed.")

    resolve_public_ips(parts.hostname, effective_port)
    return urlunsplit((scheme, parts.netloc, parts.path or "/", parts.query, ""))


def _connect_to_validated_address(conn):
    """Open the socket for a urllib3 connection, only ever to a public address."""
    try:
        addresses = resolve_public_ips(conn._dns_host, conn.port)
    except UnsafeURLError as exc:
        raise NewConnectionError(conn, str(exc))

    last_error = None
    for address in addresses:
        try:
            return urllib3_connection.create_connection(
                (address, conn.port),
                conn.timeout,
                source_address=conn.source_address,
                socket_options=conn.socket_options,
            )
        except OSError as exc:
            last_error = exc
    raise NewConnectionError(conn, "Failed to establish a new connection: %s" % last_error)


class _SafeHTTPConnection(HTTPConnection):
    def _new_conn(self):
        return _connect_to_validated_address(self)


class _SafeHTTPSConnection(HTTPSConnection):
    # TLS is still negotiated against the host name, so certificate checks are unchanged.
    def _new_conn(self):
        return _connect_to_validated_address(self)


class _SafeHTTPConnectionPool(HTTPConnectionPool):
    ConnectionCls = _SafeHTTPConnection


class _SafeHTTPSConnectionPool(HTTPSConnectionPool):
    ConnectionCls = _SafeHTTPSConnection


class SafeHTTPAdapter(HTTPAdapter):
    """requests adapter whose connections refuse non-public addresses."""

    def init_poolmanager(self, *args, **kwargs):
        super().init_poolmanager(*args, **kwargs)
        self.poolmanager.pool_classes_by_scheme = {
            "http": _SafeHTTPConnectionPool,
            "https": _SafeHTTPSConnectionPool,
        }
