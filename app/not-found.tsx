import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="not-found-page page-shell">
      <p className="section-label">404 / PAGE NOT FOUND</p>
      <h1>THIS PAGE IS NOT PART OF THE CURRENT SYSTEM.</h1>
      <p>
        页面可能已经移动，或这个实验尚未发布。返回首页可以重新进入 MORPH//LAB 的作品与方法。
      </p>
      <Link className="not-found-link" href="/">
        Back to home
      </Link>
    </main>
  );
}
