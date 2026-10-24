// Satu siswa satu data: Ayah, Ibu, Wali adalah subdata, bukan entri siswa.
const collator=new Intl.Collator("id",{numeric:true,sensitivity:"base"});
export const PARENT_PAGE_SIZE=50;
export function groupParentStudents(contacts=[],{search="",status="all",classId=""}={}){
  const map=new Map();
  for(const item of contacts){
    if(!item?.student_id)continue;
    let student=map.get(item.student_id);
    if(!student){
      student={id:item.student_id,student_id:item.student_id,
        student_name:item.student_name||"Tanpa Nama",
        class_name:item.class_name||"Tanpa Kelas",nis:item.nis||"",
        contacts:{father:null,mother:null,guardian:null}};
      map.set(item.student_id,student);
    }
    if(item.class_name)student.class_name=item.class_name;
    if(["father","mother","guardian"].includes(item.relationship))
      student.contacts[item.relationship]=item;
  }
  const query=String(search).trim().toLocaleLowerCase("id");
  const students=[...map.values()].filter(student=>{
    const contacts=Object.values(student.contacts).filter(Boolean);
    const hasLinked=contacts.some(x=>x.account_linked===true);
    if(status==="linked"&&!hasLinked)return false;
    if(status==="unlinked"&&hasLinked)return false;
    if(classId&&student.class_name!==classId)return false;
    if(!query)return true;
    return [student.student_name,student.class_name,student.nis,
      ...contacts.flatMap(c=>[c.contact_name,c.phone])]
      .some(part=>String(part||"").toLocaleLowerCase("id").includes(query));
  });
  students.sort((a,b)=>collator.compare(a.class_name,b.class_name)||
    collator.compare(a.student_name,b.student_name));
  return students;
}
export function groupParentsByClass(students=[]){
  const groups=[];
  for(const student of students){
    let group=groups[groups.length-1];
    if(!group||group.name!==student.class_name){
      group={name:student.class_name,students:[]};groups.push(group);
    }
    group.students.push(student);
  }
  return groups;
}
