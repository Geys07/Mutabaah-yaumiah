
import PromotionManager from "./PromotionManager";
import SemesterBoundaryManager from "./SemesterBoundaryManager";
import AcademicYearsBase from "./AcademicYearsBase";

export default function AcademicYears() {
  return (
    <>
      <PromotionManager />
      <SemesterBoundaryManager />
      <AcademicYearsBase />
    </>
  );
}
