import net from 'node:net';

// Minimal text-query protocol for the isolated, trust-authenticated fixture only.
// No password/token support and no remote address or database override.
export async function fixtureSql(query) {
  const socket=net.createConnection({host:'127.0.0.1',port:55436});
  let buffer=Buffer.alloc(0),pending,readyResolve,readyReject;
  const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
  const fail=error=>{readyReject(error);pending?.reject(error);pending=null;};
  socket.setTimeout(15000,()=>{fail(new Error('Local fixture timeout'));socket.destroy();});
  socket.on('error',fail);
  socket.on('close',()=>fail(new Error('Local fixture closed')));
  socket.on('connect',()=>{
    const body=Buffer.from('user\0qa06\0database\0postqa06_fixture\0client_encoding\0UTF8\0\0');
    const start=Buffer.alloc(8);start.writeInt32BE(body.length+8);start.writeInt32BE(196608,4);
    socket.write(Buffer.concat([start,body]));
  });
  socket.on('data',chunk=>{
    buffer=Buffer.concat([buffer,chunk]);
    while(buffer.length>=5){
      const type=String.fromCharCode(buffer[0]),length=buffer.readInt32BE(1);
      if(length<4||length>32*1024*1024){fail(new Error('Invalid fixture packet'));socket.destroy();return;}
      if(buffer.length<length+1)return;
      const body=buffer.subarray(5,length+1);buffer=buffer.subarray(length+1);
      if(type==='R'&&body.readInt32BE(0)!==0){fail(new Error('Fixture must use loopback trust authentication'));socket.destroy();return;}
      if(type==='E'){
        const fields={};let i=0;while(i<body.length&&body[i]){const key=String.fromCharCode(body[i++]),end=body.indexOf(0,i);fields[key]=body.toString('utf8',i,end);i=end+1;}
        const error=new Error(fields.M||'Fixture SQL failed');error.code=fields.C;
        if(pending)pending.error=error;else fail(error);
      }
      if(type==='D'&&pending){
        const row=[];let offset=2;
        for(let i=0;i<body.readInt16BE(0);i++){const n=body.readInt32BE(offset);offset+=4;row.push(n===-1?null:body.toString('utf8',offset,offset+n));if(n!==-1)offset+=n;}
        pending.rows.push(row);
      }
      if(type==='Z'){
        if(pending){const task=pending;pending=null;task.error?task.reject(task.error):task.resolve(task.rows);}else readyResolve();
      }
    }
  });
  function run(sql){return new Promise((resolve,reject)=>{
    pending={resolve,reject,rows:[]};const body=Buffer.from(sql+'\0'),head=Buffer.alloc(5);head[0]=81;head.writeInt32BE(body.length+4,1);socket.write(Buffer.concat([head,body]));
  });}
  try{
    await ready;
    const guard=await run("select current_database()||':'||current_setting('port')");
    if(guard[0]?.[0]!=='postqa06_fixture:55436')throw new Error('Local fixture only');
    return (await run(query)).map(row=>row.map(v=>v??'').join('|')).join('\n').trim();
  }finally{socket.end(Buffer.from([88,0,0,0,4]));socket.destroy();}
}
