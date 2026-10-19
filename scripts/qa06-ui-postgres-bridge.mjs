// Tool-driven local fixture bridge. No HTTP listener, credentials, or production endpoint.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const connection='host=127.0.0.1 port=55436 user=qa06 dbname=qa06_fixture connect_timeout=5';
async function sql(query){return (await exec('C:/Program Files/PostgreSQL/18/bin/psql.exe',['-X','-qAt','-v','ON_ERROR_STOP=1','-d',connection,'-c',query],{windowsHide:true})).stdout.trim();}
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
export async function executeFixtureRequests(requests){
 if(await sql("select current_database()||':'||current_setting('port')")!=='qa06_fixture:55436')throw Error('local fixture only');
 const result=[];
 for(const request of requests){
  try{
   let expression;
   if(request.kind==='activities'){
    const data=JSON.parse(await sql("select coalesce(json_agg(a order by sort_order,title),'[]'::json) from mutabaah_activities a where is_active and category<>'ramadan'"));result.push({id:request.id,data});continue;
   }
   const {name,args}=request;
   if(!args||typeof args.p_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(args.p_date))throw Error('date');
   if(name==='get_parent_ramadan_day_activities')expression="get_parent_ramadan_day_activities('"+args.p_date+"')";
   else{
    if(!uuid(args.p_student_id))throw Error('student');
    if(name==='get_parent_mutabaah_day_state')expression="get_parent_mutabaah_day_state('"+args.p_student_id+"','"+args.p_date+"')";
    else if(name==='submit_parent_mutabaah_day'){
     if(typeof args.p_is_haid!=='boolean'||typeof args.p_finalize!=='boolean'||!Array.isArray(args.p_answers)||args.p_answers.length>100||args.p_answers.some(a=>!uuid(a.activity_id)||typeof a.completed!=='boolean'))throw Error('answers');
     const answers=args.p_answers.map(({activity_id,completed})=>({activity_id,completed}));
     expression="submit_parent_mutabaah_day('"+args.p_student_id+"','"+args.p_date+"',"+args.p_is_haid+",'"+JSON.stringify(answers)+"'::jsonb,"+args.p_finalize+")";
    }else throw Error('unsupported RPC');
   }
   const data=JSON.parse(await sql("set role authenticated;set request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';select "+expression));result.push({id:request.id,data});
  }catch{result.push({id:request.id,error:{message:'fixture_rpc_failed'}});}
 }
 return result;
}
