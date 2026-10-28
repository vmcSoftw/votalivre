/** @type {import('next').NextConfig} */
const nextConfig={
 poweredByHeader:false,
 productionBrowserSourceMaps:false,
 reactStrictMode:true,
 async headers(){return [{source:'/:path*',headers:[
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Referrer-Policy',value:'no-referrer'},
  {key:'Cache-Control',value:'no-store, private'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()'},
  ...(process.env.NODE_ENV==='production'?[{key:'Strict-Transport-Security',value:'max-age=63072000; includeSubDomains'}]:[])
 ]}];}
};
export default nextConfig;
