[AXE API reference](../../README.md) / [@axe/relay](README.md) / token

# token

## Interfaces

<a id="mintrelaytokeninput"></a>

### MintRelayTokenInput

Who a relay token speaks for: one signed-in person in one tenant.

#### Extends

- [`RelayPrincipal`](server.md#relayprincipal)

#### Properties

<a id="audience"></a>

##### audience?

```ts
optional audience?: string;
```

The `aud` claim. Default `axe-relay`; the relay's `audience` option must match.

<a id="claims"></a>

##### claims?

```ts
optional claims?: Record<string, RelayClaimValue>;
```

Extra claims to carry, such as a member id (`{ mid: "m_42" }`). Registered claim names are refused.

<a id="now"></a>

##### now?

```ts
optional now?: number;
```

Clock in ms, for tests.

<a id="principal"></a>

##### principal

```ts
principal: string;
```

###### Inherited from

[`RelayPrincipal`](server.md#relayprincipal).[`principal`](server.md#principal)

<a id="tenant"></a>

##### tenant

```ts
tenant: string;
```

###### Inherited from

[`RelayPrincipal`](server.md#relayprincipal).[`tenant`](server.md#tenant)

<a id="ttl"></a>

##### ttl?

```ts
optional ttl?: number;
```

Lifetime in seconds. Default 600 (ten minutes); at most one day. The page renews in-band.

***

<a id="relaytokenclaims"></a>

### RelayTokenClaims

What `verifyRelayToken` returns for a valid token.

#### Extends

- [`RelayPrincipal`](server.md#relayprincipal)

#### Properties

<a id="claims-1"></a>

##### claims

```ts
claims: Record<string, unknown>;
```

Every claim the token carried, as sent.

<a id="exp"></a>

##### exp

```ts
exp: number;
```

Expiry, seconds since the epoch.

<a id="iat"></a>

##### iat

```ts
iat: number;
```

Issued at, seconds since the epoch (the verification time when the token has none).

<a id="jti"></a>

##### jti

```ts
jti: string;
```

The token's id, or a digest of the token when it has none; the relay revokes it on Stop.

<a id="principal-1"></a>

##### principal

```ts
principal: string;
```

###### Inherited from

[`RelayPrincipal`](server.md#relayprincipal).[`principal`](server.md#principal)

<a id="tenant-1"></a>

##### tenant

```ts
tenant: string;
```

###### Inherited from

[`RelayPrincipal`](server.md#relayprincipal).[`tenant`](server.md#tenant)

***

<a id="verifyrelaytokenoptions"></a>

### VerifyRelayTokenOptions

#### Properties

<a id="audience-1"></a>

##### audience?

```ts
optional audience?: string;
```

The audience to require. Default `axe-relay`.

<a id="now-1"></a>

##### now?

```ts
optional now?: number;
```

Clock in ms, for tests.

## Type Aliases

<a id="relayclaimvalue"></a>

### RelayClaimValue

```ts
type RelayClaimValue = string | number | boolean | null;
```

The value of an extra claim a relay token carries.

## Variables

<a id="max_relay_token_ttl"></a>

### MAX\_RELAY\_TOKEN\_TTL

```ts
const MAX_RELAY_TOKEN_TTL: number;
```

The longest lifetime a relay token may have, in seconds: one day. Minutes are the intended scale.

***

<a id="relay_audience"></a>

### RELAY\_AUDIENCE

```ts
const RELAY_AUDIENCE: "axe-relay" = "axe-relay";
```

The audience relay tokens carry unless you choose another.

## Functions

<a id="mintrelaytoken"></a>

### mintRelayToken()

```ts
function mintRelayToken(input, secret): Promise<string>;
```

Mint a relay token for the signed-in person. Call it in your backend, in a request your own
session authenticated, and return the token to your own page (never in a URL).

#### Parameters

##### input

[`MintRelayTokenInput`](#mintrelaytokeninput)

##### secret

`string`

#### Returns

`Promise`\<`string`\>

***

<a id="verifyrelaytoken"></a>

### verifyRelayToken()

```ts
function verifyRelayToken(
   token, 
   secret, 
   options?
): Promise<RelayTokenClaims | null>;
```

Check a relay token: the HS256 signature, the audience, the expiry, and a lifetime of at most
one day. Returns its principal (`sub`), tenant (`org`), and claims, or null for any token that
is not valid now. Never throws for a bad token.

#### Parameters

##### token

`string`

##### secret

`string`

##### options?

[`VerifyRelayTokenOptions`](#verifyrelaytokenoptions) = `{}`

#### Returns

`Promise`\<[`RelayTokenClaims`](#relaytokenclaims) \| `null`\>

## References

<a id="relayprincipal"></a>

### RelayPrincipal

Re-exports [RelayPrincipal](server.md#relayprincipal)
