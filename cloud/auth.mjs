const keys = new Map();
const decode = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
export async function verifyAccess(token, {issuer, audience, fetcher=fetch, now=Date.now()/1000}) {
  if (!token || !issuer || !audience) throw new Error('Sign in to DigiPoly to use cloud saving.');
  const parts=token.split('.');
  if(parts.length!==3) throw new Error('Invalid sign-in token.');
  const header=JSON.parse(new TextDecoder().decode(decode(parts[0]))), claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if(header.alg!=='RS256'||typeof header.kid!=='string'||claims.iss!==issuer||!Array.isArray(claims.aud)||!claims.aud.includes(audience)||!Number.isFinite(claims.exp)||claims.exp<=now||claims.nbf>now+30||typeof claims.sub!=='string'||!claims.sub||typeof claims.email!=='string') throw new Error('Sign-in has expired or is not for DigiPoly.');
  let cached=keys.get(issuer);
  if(!cached||cached.until<now||!cached.jwks.some(k=>k.kid===header.kid)) {
    const response=await fetcher(`${issuer}/cdn-cgi/access/certs`);
    if(!response.ok) throw new Error('Sign-in could not be verified.');
    cached={jwks:(await response.json()).keys,until:now+3600};keys.set(issuer,cached);
  }
  const jwk=cached.jwks.find(k=>k.kid===header.kid&&k.kty==='RSA');
  if(!jwk) throw new Error('Unknown sign-in key.');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts.slice(0,2).join('.')))) throw new Error('Invalid sign-in signature.');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${issuer}|${claims.sub}`));
  return {id:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),email:claims.email};
}
