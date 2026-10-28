import {NextResponse} from 'next/server';
export function middleware(req){
 const nonce=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))));
 const development=process.env.NODE_ENV!=='production';
 const csp=["default-src 'self'",`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development?" 'unsafe-eval'":''}`,
  "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self'", "connect-src 'self'",
  "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'", ...(development?[]:["upgrade-insecure-requests"])].join('; ');
 const headers=new Headers(req.headers);headers.set('x-nonce',nonce);headers.set('Content-Security-Policy',csp);
 const response=NextResponse.next({request:{headers}});response.headers.set('Content-Security-Policy',csp);
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
