import './globals.css';
export const dynamic='force-dynamic';
export const metadata={title:'VotaLivre v0.9 |  Eleições digitais para instituições',description:'Plataforma responsiva de votações institucionais com controles de privacidade.'};
export default function RootLayout({children}){
 return <html lang="pt-BR"><body><header className="topbar"><a href="/" className="brand"><span className="brand-icon">◈</span> Vota<span>Livre</span><span className="tag">BETA</span></a><nav aria-label="Menu principal"><a href="/">Início</a><a href="/admin">Painel de gestão ↗</a></nav></header><main>{children}</main><footer><strong>◈ VotaLivre</strong><span>Votações institucionais • Protótipo v0.9 em validação independente. Capturas de tela não podem ser impedidas universalmente.</span></footer></body></html>;
}
