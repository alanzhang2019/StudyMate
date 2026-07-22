import AdminClassroomView from '../classroom/AdminClassroomView';

export default function AdminCspLecturePage() {
  return (
    <AdminClassroomView
      collection="csp-lecture"
      pageTitle="CSP初赛要点精讲"
      pageDescription="专门模块：将 OpenMAIC 导出的 CSP 初赛课件上传到这里。它们会自动出现在公开页 /csp-lecture 中供学生访问。"
      emptyHint="还没有 CSP 初赛课件。请从 OpenMAIC 导出课件并上传到上方。"
      itemBadgeLabel="CSP初赛课件"
    />
  );
}
