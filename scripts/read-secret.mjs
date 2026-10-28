export async function readSecret(prompt){
 if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('É necessário terminal interativo para inserir senha sem eco');
 return new Promise((resolve,reject)=>{
  const input=process.stdin;
  let pass='';
  process.stdout.write(prompt);
  input.setRawMode(true);input.resume();input.setEncoding('utf8');
  function close(){input.setRawMode(false);input.pause();input.off('data',onData);process.stdout.write('\n');}
  function onData(key){
   for(const c of key){
    if(c==='\r'||c==='\n'){close();resolve(pass);return;}
    if(c==='\u0003'){close();reject(Error('Entrada cancelada'));return;}
    if(c==='\u007f'||c==='\b'){pass=pass.slice(0,-1);continue;}
    if(pass.length<1024&&c>=' '&&c!=='\u007f')pass+=c;
   }
  }
  input.on('data',onData);
 });
}
