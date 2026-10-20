
import { useState } from "react";
import StudentsBase from "./StudentsBase";
import StudentAdminTools from "./StudentAdminTools";
import StudentHistoryPanel from "./StudentHistoryPanel";

export default function Students() {
  const [revision, setRevision] = useState(0);

  return (
    <>
      <StudentsBase key={revision} />

      <StudentAdminTools
        onChanged={() =>
          setRevision((n) => n + 1)
        }
      />

      <StudentHistoryPanel />
    </>
  );
}
