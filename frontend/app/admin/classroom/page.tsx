import AdminClassroomView from './AdminClassroomView';

export default function AdminClassroomPage() {
  return (
    <AdminClassroomView
      pageTitle="课堂管理"
      pageDescription="从 OpenMAIC 导出 .maic.zip 文件并上传到此处，系统会自动解压并存到课堂库。"
      emptyHint="还没有课堂。请从 OpenMAIC 导出课件并上传到上方。"
    />
  );
}
