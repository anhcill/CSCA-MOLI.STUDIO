"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/layout/AdminLayout";
import { useAuthStore } from "@/lib/store/authStore";
import { hasPermission } from "@/lib/utils/permissions";
import { seoBlogApi, SeoPost, SeoIdea, SeoImage } from "@/lib/api/seoBlog";
import {
  FiArchive,
  FiCalendar,
  FiCheckCircle,
  FiEdit3,
  FiExternalLink,
  FiFileText,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiTrash2,
  FiX,
} from "react-icons/fi";

const TOPICS = [
  ["Luyện thi CSCA", "luyện thi CSCA"],
  ["Toán CSCA", "toán CSCA"],
  ["Vật lý CSCA", "vật lý CSCA"],
  ["Hóa học CSCA", "hóa học CSCA"],
  ["Tiếng Trung CSCA", "tiếng Trung CSCA"],
  ["Đề thi & chiến thuật", "đề thi CSCA"],
  ["Học bổng CSC", "học bổng CSC"],
  ["Học bổng trường", "học bổng đại học Trung Quốc"],
  ["Hồ sơ du học", "hồ sơ du học Trung Quốc"],
  ["Visa & thủ tục", "visa du học Trung Quốc"],
  ["Chọn trường & ngành", "chọn trường Trung Quốc"],
  ["Chi phí du học", "chi phí du học Trung Quốc"],
  ["Đời sống du học sinh", "đời sống du học Trung Quốc"],
  ["Kinh nghiệm apply", "kinh nghiệm apply Trung Quốc"],
  ["Công cụ & tài liệu học", "tài liệu ôn thi CSCA"],
];
const blank: Partial<SeoPost> = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  meta_title: "",
  meta_description: "",
  primary_keyword: "",
  secondary_keywords: [],
  category: "Luyện thi CSCA",
  search_intent: "informational",
  status: "draft",
};
const cls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
type AiTask = { mode: "ideas" | "article"; done?: boolean } | null;

export default function Page() {
  const router = useRouter(),
    { user } = useAuthStore(),
    allowed = hasPermission(user, "content.manage");
  const [posts, setPosts] = useState<SeoPost[]>([]),
    [draft, setDraft] = useState<Partial<SeoPost>>(blank),
    [secondary, setSecondary] = useState(""),
    [ideas, setIdeas] = useState<SeoIdea[]>([]),
    [ideasLoading, setIdeasLoading] = useState(false),
    [imageOptions, setImageOptions] = useState<SeoImage[]>([]),
    [ideaFocus, setIdeaFocus] = useState(""),
    [ideaStatus, setIdeaStatus] = useState<"unused" | "used" | "all">("unused"),
    [selectedIdeaId, setSelectedIdeaId] = useState<SeoIdea["id"] | null>(null),
    [aiTask, setAiTask] = useState<AiTask>(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [notice, setNotice] = useState("");
  const load = async () => {
    setLoading(true);
    try {
      setPosts((await seoBlogApi.list({ search, status })).posts);
    } catch {
      setNotice("Không tải được danh sách bài viết.");
    } finally {
      setLoading(false);
    }
  };
  const loadIdeas = async (nextStatus: typeof ideaStatus = ideaStatus) => {
    setIdeasLoading(true);
    try {
      setIdeas(await seoBlogApi.listIdeas(nextStatus));
    } catch {
      setNotice("Không tải được kho ý tưởng.");
    } finally {
      setIdeasLoading(false);
    }
  };
  useEffect(() => {
    if (user && !allowed) router.replace("/admin");
  }, [user, allowed, router]);
  useEffect(() => {
    if (allowed) void load();
  }, [allowed, status]); // eslint-disable-line react-hooks/exhaustive-deps
  const edit = (p?: SeoPost) => {
    const v = p || blank;
    setDraft({ ...v });
    setSecondary((v.secondary_keywords || []).join(", "));
    setSelectedIdeaId(null);
    setImageOptions([]);
    setOpen(true);
    void loadIdeas();
  };
  const payload = () => ({
    ...draft,
    secondary_keywords: secondary
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  });
  const save = async () => {
    setBusy(true);
    try {
      const p = payload();
      const x = draft.id
        ? await seoBlogApi.update(draft.id, p)
        : await seoBlogApi.create(p);
      setDraft(x);
      setNotice("Đã lưu bản nháp.");
      await load();
    } catch {
      setNotice("Lưu bài thất bại.");
    } finally {
      setBusy(false);
    }
  };
  const findImage = async () => {
    if (!draft.primary_keyword) {
      setNotice("Hãy nhập từ khóa chính trước khi tìm ảnh.");
      return;
    }
    setBusy(true);
    try {
      const images = await seoBlogApi.searchImages(draft.primary_keyword, draft.topic || draft.category, imageOptions.length ? Math.floor(Math.random() * 5) + 2 : 1);
      if (!images.length) {
        setNotice(
          "Chưa tìm thấy ảnh. Hãy cấu hình Pexels, Unsplash hoặc thư viện ảnh chủ đề.",
        );
        return;
      }
      setImageOptions(images);
      setNotice(`Đã tìm thấy ${images.length} ảnh. Hãy chọn ảnh phù hợp.`);
    } catch {
      setNotice("Tìm ảnh thất bại.");
    } finally {
      setBusy(false);
    }
  };
  const chooseImage = (image: SeoImage) => {
    setDraft({
      ...draft,
      cover_image: image.url,
      cover_image_alt: image.alt,
      cover_image_source: image.source,
      cover_image_source_url: image.source_url,
    });
    setNotice("Đã chọn ảnh mới, nhớ lưu lại bản nháp.");
  };
  const finishAiTask = (mode: "ideas" | "article") => {
    setAiTask({ mode, done: true });
    window.setTimeout(() => setAiTask(null), 1800);
  };
  const suggestIdeas = async () => {
    setBusy(true);
    setAiTask({ mode: "ideas" });
    setNotice("AI đang nghiên cứu các cụm chủ đề chưa bị trùng...");
    try {
      const next = await seoBlogApi.suggestIdeas(ideaFocus);
      setIdeaStatus("unused");
      await loadIdeas("unused");
      finishAiTask("ideas");
      setNotice(
        `AI đã tạo ${next.length} ý tưởng khác nhau. Chọn một ý tưởng bên dưới.`,
      );
    } catch {
      setAiTask(null);
      setNotice("Không thể tạo ý tưởng lúc này.");
    } finally {
      setBusy(false);
    }
  };
  const chooseIdea = (idea: SeoIdea) => {
    setSelectedIdeaId(idea.id);
    setDraft({
      ...draft,
      topic: idea.topic,
      category: idea.category,
      primary_keyword: idea.primary_keyword,
      search_intent: idea.search_intent,
    });
    setSecondary((idea.secondary_keywords || []).join(", "));
    setNotice(`Đã chọn: ${idea.primary_keyword}`);
  };
  const generate = async () => {
    if (!draft.primary_keyword) {
      setNotice("Hãy nhập từ khóa chính.");
      return;
    }
    setBusy(true);
    setAiTask({ mode: "article" });
    setNotice("AI đang viết bản nháp...");
    try {
      const x = await seoBlogApi.generateDraft({
        primary_keyword: draft.primary_keyword,
        secondary_keywords: payload().secondary_keywords || [],
        category: draft.category || "",
        search_intent: draft.search_intent || "informational",
        topic: draft.topic,
      });
      setDraft(x);
      setSecondary((x.secondary_keywords || []).join(", "));
      if (selectedIdeaId) {
        await seoBlogApi.updateIdea(selectedIdeaId, {
          status: "used",
          used_post_id: x.id,
        });
        setSelectedIdeaId(null);
        await loadIdeas();
      }
      finishAiTask("article");
      setNotice(x.reused_existing
        ? "Từ khóa này đã có bài. Hệ thống đã mở lại bài cũ và đánh dấu ý tưởng là đã dùng."
        : "Đã tạo xong, ý tưởng đã được đánh dấu đã dùng. Hãy duyệt kỹ trước khi đăng.");
      await load();
    } catch {
      setAiTask(null);
      setNotice("Tạo bài thất bại. Kiểm tra cấu hình AI/backend.");
    } finally {
      setBusy(false);
    }
  };
  const act = async (k: string) => {
    if (!draft.id) {
      setNotice("Hãy lưu bản nháp trước.");
      return;
    }
    if (k === "delete" && !confirm("Xóa vĩnh viễn bài này?")) return;
    setBusy(true);
    try {
      if (k === "publish") await seoBlogApi.publish(draft.id);
      if (k === "schedule") {
        if (!draft.scheduled_at) throw 0;
        await seoBlogApi.schedule(
          draft.id,
          new Date(draft.scheduled_at).toISOString(),
        );
      }
      if (k === "archive") await seoBlogApi.archive(draft.id);
      if (k === "delete") await seoBlogApi.remove(draft.id);
      setOpen(false);
      setNotice("Đã cập nhật bài viết.");
      await load();
    } catch {
      setNotice("Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  };
  const removeFromList = async (post: SeoPost) => {
    if (!confirm(`Xóa vĩnh viễn bài “${post.title}”?`)) return;
    setBusy(true);
    try {
      await seoBlogApi.remove(post.id);
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setNotice("Đã xóa bài viết.");
    } catch {
      setNotice("Xóa bài viết thất bại.");
    } finally {
      setBusy(false);
    }
  };
  const shown = useMemo(
    () =>
      posts.filter(
        (p) =>
          !search ||
          `${p.title} ${p.primary_keyword}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [posts, search],
  );
  if (!allowed) return null;
  return (
    <AdminLayout
      title="SEO Blog tự động"
      description="Tạo, tối ưu và đặt lịch bài viết — không cần deploy lại website"
    >
      <div className="space-y-5">
        {notice && (
          <div className="flex justify-between rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800">
            {notice}
            <button onClick={() => setNotice("")}>
              <FiX />
            </button>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          <Stat l="Tổng bài" v={posts.length} />
          <Stat
            l="Đã xuất bản"
            v={posts.filter((p) => p.status === "published").length}
          />
          <Stat
            l="Chờ lịch"
            v={posts.filter((p) => p.status === "scheduled").length}
          />
        </div>
        <section className="rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold dark:text-white">Kho nội dung</h2>
              <p className="text-sm text-slate-500">
                Duyệt bản nháp trước khi xuất bản.
              </p>
            </div>
            <button
              onClick={() => edit()}
              className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              <FiPlus /> Tạo bài bằng AI
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
            <label className="relative">
              <FiSearch className="absolute left-3 top-3 text-slate-400" />
              <input
                className={`${cls} pl-9`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm bài hoặc từ khóa..."
              />
            </label>
            <select
              className={cls}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Mọi trạng thái</option>
              <option value="draft">Bản nháp</option>
              <option value="scheduled">Đặt lịch</option>
              <option value="published">Đã đăng</option>
              <option value="archived">Lưu trữ</option>
            </select>
            <button onClick={load} className="rounded-xl border px-4">
              <FiRefreshCw />
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-3">Bài viết</th>
                  <th>Từ khóa</th>
                  <th>SEO</th>
                  <th>Trạng thái</th>
                  <th>Lịch đăng</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center">
                      Đang tải...
                    </td>
                  </tr>
                ) : (
                  shown.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3">
                        <b className="dark:text-white">{p.title}</b>
                        <p className="text-xs text-slate-400">/{p.slug}</p>
                      </td>
                      <td>{p.primary_keyword}</td>
                      <td>{p.seo_score ?? "—"}/100</td>
                      <td>
                        <Badge s={p.status} />
                      </td>
                      <td>
                        {p.scheduled_at
                          ? new Date(p.scheduled_at).toLocaleString("vi-VN")
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap">
                        <button
                          onClick={() => edit(p)}
                          title="Chỉnh sửa"
                          className="p-2 text-violet-600"
                        >
                          <FiEdit3 />
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => removeFromList(p)}
                          title="Xóa bài viết"
                          className="p-2 text-red-500 disabled:opacity-40"
                        >
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-3">
          <div className="mx-auto my-3 max-w-6xl rounded-2xl bg-slate-50 dark:bg-slate-950">
            <header className="sticky top-0 z-10 flex justify-between rounded-t-2xl border-b bg-white/95 p-4 dark:border-slate-800 dark:bg-slate-900/95">
              <div>
                <b className="dark:text-white">
                  {draft.id ? "Biên tập bài SEO" : "Tạo bài SEO mới"}
                </b>
                <p className="text-xs text-slate-500">
                  Múi giờ: Asia/Ho_Chi_Minh
                </p>
              </div>
              <button onClick={() => setOpen(false)}>
                <FiX />
              </button>
            </header>
            {aiTask && (
              <div className="px-5 pt-5">
                <AiProgress task={aiTask} />
              </div>
            )}
            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_330px]">
              <main className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-fuchsia-100 bg-white px-3 py-2">
                  <div>
                    <b className="text-sm text-fuchsia-800">
                      Kho ý tưởng SEO đã lưu
                    </b>
                    <p className="text-xs text-slate-500">
                      {ideas.length} ý tưởng · chọn để dùng dần
                    </p>
                  </div>
                  <div className="flex rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-1">
                    {([['unused','Chưa dùng'],['used','Đã dùng'],['all','Tất cả']] as const).map(([value,label]) => (
                      <button
                        key={value}
                        type="button"
                        disabled={ideasLoading}
                        onClick={() => { setIdeaStatus(value); setSelectedIdeaId(null); void loadIdeas(value); }}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${ideaStatus===value?'bg-fuchsia-600 text-white shadow':'text-fuchsia-700 hover:bg-white'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <Card t="1. Từ khóa & ý định">
                  <div className="mb-4 rounded-xl border border-fuchsia-100 bg-fuchsia-50/60 p-3">
                    <p className="text-sm font-bold text-fuchsia-800">
                      Để AI tự lên cụm chủ đề đa dạng
                    </p>
                    <p className="mb-2 text-xs text-fuchsia-600">
                      AI sẽ tránh từ khóa đã có và tạo 12 góc nội dung khác
                      nhau.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        className={cls}
                        value={ideaFocus}
                        onChange={(e) => setIdeaFocus(e.target.value)}
                        placeholder="Định hướng tùy chọn, ví dụ: học bổng, đời sống..."
                      />
                      <button
                        disabled={busy}
                        onClick={suggestIdeas}
                        className="shrink-0 rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white"
                      >
                        AI đề xuất ý tưởng
                      </button>
                    </div>
                    {ideasLoading ? <div className="mt-3 rounded-xl bg-white p-5 text-center text-sm text-fuchsia-600">Đang lọc ý tưởng...</div> : ideas.length > 0 ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {ideas.map((idea, index) => (
                          <button
                            key={`${idea.primary_keyword}-${index}`}
                            onClick={() => chooseIdea(idea)}
                            className={`relative rounded-xl border-2 bg-white p-3 text-left transition ${selectedIdeaId===idea.id?'border-fuchsia-600 ring-2 ring-fuchsia-200':'border-fuchsia-100 hover:border-fuchsia-400'}`}
                          >
                            {selectedIdeaId===idea.id && <span className="absolute right-2 top-2 rounded-full bg-fuchsia-600 px-2 py-0.5 text-[10px] font-bold text-white">Đang chọn</span>}
                            <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${idea.status==='used'?'bg-slate-100 text-slate-500':'bg-emerald-100 text-emerald-700'}`}>{idea.status==='used'?'Đã dùng':'Chưa dùng'}</span>
                            <b className="block text-sm text-slate-800">
                              {idea.primary_keyword}
                            </b>
                            <span className="text-xs text-slate-500">
                              {idea.category} ·{" "}
                              {idea.angle || idea.search_intent}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : <div className="mt-3 rounded-xl border border-dashed border-fuchsia-200 bg-white p-5 text-center text-sm text-slate-500">Không có ý tưởng trong danh sách này.</div>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      className={cls}
                      value={draft.category}
                      onChange={(e) =>
                        setDraft({ ...draft, category: e.target.value })
                      }
                    >
                      {TOPICS.map((x) => (
                        <option key={x[0]}>{x[0]}</option>
                      ))}
                    </select>
                    <select
                      className={cls}
                      value={draft.search_intent}
                      onChange={(e) =>
                        setDraft({ ...draft, search_intent: e.target.value })
                      }
                    >
                      <option value="informational">Tìm thông tin</option>
                      <option value="commercial">So sánh</option>
                      <option value="transactional">Chuyển đổi</option>
                    </select>
                    <input
                      list="keys"
                      className={cls}
                      value={draft.primary_keyword || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, primary_keyword: e.target.value })
                      }
                      placeholder="Từ khóa chính *"
                    />
                    <datalist id="keys">
                      {TOPICS.map((x) => (
                        <option key={x[1]} value={x[1]} />
                      ))}
                    </datalist>
                    <input
                      className={cls}
                      value={secondary}
                      onChange={(e) => setSecondary(e.target.value)}
                      placeholder="Từ khóa phụ, cách nhau bằng dấu phẩy"
                    />
                  </div>
                  <button
                    disabled={busy}
                    onClick={generate}
                    className="mt-3 flex gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    <FiFileText />
                    {busy ? "Đang xử lý..." : "Tạo bản nháp chuẩn SEO"}
                  </button>
                </Card>
                <Card t="2. Nội dung & metadata">
                  <Fields draft={draft} setDraft={setDraft} />
                </Card>
              </main>
              <aside className="space-y-4">
                <Card t="Ảnh đúng chủ đề">
                  {draft.cover_image ? (
                    <img
                      src={draft.cover_image}
                      alt={draft.cover_image_alt || ""}
                      className="mb-3 aspect-video w-full rounded-xl object-cover"
                    />
                  ) : (
                    <div className="mb-3 flex aspect-video items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
                      Chưa có ảnh
                    </div>
                  )}
                  <button
                    disabled={busy}
                    onClick={findImage}
                    className="mb-2 w-full rounded-xl border border-violet-200 px-3 py-2 text-sm font-semibold text-violet-700"
                  >
                    {imageOptions.length ? "Đổi danh sách ảnh khác" : "Chọn / đổi ảnh"}
                  </button>
                  {imageOptions.length > 0 && (
                    <div className="mb-3 grid max-h-72 grid-cols-2 gap-2 overflow-y-auto rounded-xl bg-slate-100 p-2">
                      {imageOptions.map((image) => (
                        <button
                          key={image.url}
                          type="button"
                          onClick={() => chooseImage(image)}
                          title={`Chọn ảnh từ ${image.source}`}
                          className={`overflow-hidden rounded-lg border-2 bg-white ${draft.cover_image === image.url ? "border-violet-600" : "border-transparent hover:border-violet-300"}`}
                        >
                          <img
                            src={image.thumbnail || image.url}
                            alt={image.alt || "Ảnh gợi ý"}
                            className="aspect-video w-full object-cover"
                          />
                          <span className="block truncate px-1 py-1 text-[10px] text-slate-500">
                            {image.source}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    className={cls}
                    value={draft.cover_image || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, cover_image: e.target.value })
                    }
                    placeholder="URL ảnh"
                  />
                  <input
                    className={`${cls} mt-2`}
                    value={draft.cover_image_alt || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, cover_image_alt: e.target.value })
                    }
                    placeholder="Alt ảnh"
                  />
                  {draft.cover_image_source_url && (
                    <a
                      href={draft.cover_image_source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 flex gap-1 text-xs text-violet-600"
                    >
                      <FiExternalLink />
                      {draft.cover_image_source || "Nguồn ảnh"}
                    </a>
                  )}
                </Card>
                <Card t={`Điểm SEO: ${draft.seo_score ?? "—"}/100`}>
                  <div className="h-2 rounded bg-slate-200">
                    <div
                      className="h-full rounded bg-emerald-500"
                      style={{ width: `${draft.seo_score || 0}%` }}
                    />
                  </div>
                  {draft.seo_issues?.map((x, i) => (
                    <p key={i} className="mt-2 flex gap-2 text-xs">
                      <FiCheckCircle
                        className={x.ok ? "text-emerald-500" : "text-amber-500"}
                      />
                      {x.message}
                    </p>
                  ))}
                </Card>
                {!!draft.cannibalization?.length && (
                  <Card t="Cảnh báo trùng từ khóa">
                    {draft.cannibalization.map((x) => (
                      <p
                        key={x.id}
                        className="mb-2 rounded bg-amber-50 p-2 text-xs text-amber-800"
                      >
                        <b>{x.title}</b>
                        {x.similarity != null &&
                          ` · ${Math.round(x.similarity * 100)}% giống`}
                      </p>
                    ))}
                  </Card>
                )}
                <Card t="Xuất bản">
                  <label className="text-xs font-semibold">
                    Ngày giờ Việt Nam
                    <input
                      type="datetime-local"
                      className={`${cls} mt-1`}
                      value={draft.scheduled_at?.slice(0, 16) || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, scheduled_at: e.target.value })
                      }
                    />
                  </label>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      disabled={busy}
                      onClick={save}
                      className="rounded-xl border p-2 text-sm text-violet-700"
                    >
                      Lưu nháp
                    </button>
                    <button
                      onClick={() => act("schedule")}
                      className="flex items-center justify-center gap-1 rounded-xl bg-slate-800 p-2 text-sm text-white"
                    >
                      <FiCalendar />
                      Đặt lịch
                    </button>
                    <button
                      onClick={() => act("publish")}
                      className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 p-2.5 text-sm text-white"
                    >
                      <FiSend />
                      Đăng ngay
                    </button>
                    {draft.id && (
                      <>
                        <button
                          onClick={() => act("archive")}
                          className="flex justify-center gap-1 p-2 text-xs"
                        >
                          <FiArchive />
                          Lưu trữ
                        </button>
                        <button
                          onClick={() => act("delete")}
                          className="flex justify-center gap-1 p-2 text-xs text-red-500"
                        >
                          <FiTrash2 />
                          Xóa
                        </button>
                      </>
                    )}
                  </div>
                </Card>
              </aside>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function Fields({
  draft,
  setDraft,
}: {
  draft: Partial<SeoPost>;
  setDraft: (x: Partial<SeoPost>) => void;
}) {
  const f =
    (k: keyof SeoPost) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft({ ...draft, [k]: e.target.value });
  return (
    <div className="space-y-3">
      <input
        className={cls}
        value={draft.title || ""}
        onChange={f("title")}
        placeholder="Tiêu đề bài"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className={cls}
          value={draft.slug || ""}
          onChange={f("slug")}
          placeholder="Slug"
        />
        <input
          className={cls}
          value={draft.meta_title || ""}
          onChange={f("meta_title")}
          placeholder="SEO title"
        />
      </div>
      <textarea
        rows={3}
        className={cls}
        value={draft.meta_description || ""}
        onChange={f("meta_description")}
        placeholder={`Meta description (${draft.meta_description?.length || 0}/160)`}
      />
      <textarea
        rows={3}
        className={cls}
        value={draft.excerpt || ""}
        onChange={f("excerpt")}
        placeholder="Đoạn giới thiệu"
      />
      <textarea
        rows={18}
        className={`${cls} font-mono`}
        value={draft.content || ""}
        onChange={f("content")}
        placeholder="Nội dung Markdown/HTML"
      />
    </div>
  );
}
function Card({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 font-bold dark:text-white">{t}</h3>
      {children}
    </section>
  );
}
function Stat({ l, v }: { l: string; v: number }) {
  return (
    <div className="rounded-2xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500">{l}</p>
      <p className="text-2xl font-black dark:text-white">{v}</p>
    </div>
  );
}
function Badge({ s }: { s: string }) {
  const m: any = {
    draft: ["Bản nháp", "bg-amber-100 text-amber-700"],
    scheduled: ["Đặt lịch", "bg-blue-100 text-blue-700"],
    published: ["Đã đăng", "bg-emerald-100 text-emerald-700"],
    archived: ["Lưu trữ", "bg-slate-100 text-slate-600"],
  };
  return (
    <span className={`rounded-full px-2 py-1 text-xs ${m[s]?.[1]}`}>
      {m[s]?.[0] || s}
    </span>
  );
}

function AiProgress({ task }: { task: Exclude<AiTask, null> }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSeconds(0);
    if (task.done) return;
    const timer = window.setInterval(
      () => setSeconds((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [task.mode, task.done]);
  const steps =
    task.mode === "ideas"
      ? [
          "Đọc danh sách từ khóa đã có",
          "Phân tích khoảng trống nội dung",
          "Tạo 12 cụm chủ đề đa dạng",
          "Kiểm tra trùng lặp và hoàn thiện",
        ]
      : [
          "Phân tích từ khóa và search intent",
          "Lập dàn ý H2/H3 và liên kết nội bộ",
          "Viết nội dung, FAQ và metadata",
          "Tìm ảnh đúng chủ đề",
          "Chấm điểm và lưu bản nháp",
        ];
  const duration = task.mode === "ideas" ? 24 : 70;
  const progress = task.done
    ? 100
    : Math.min(92, Math.max(8, Math.round((seconds / duration) * 92)));
  const current = task.done
    ? steps.length
    : Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length));
  return (
    <section className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm dark:border-violet-900 dark:bg-slate-900">
      <div className="flex items-center justify-between bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-white">
        <div>
          <p className="text-sm font-black">
            {task.done
              ? "AI đã xử lý xong"
              : task.mode === "ideas"
                ? "AI đang nghiên cứu ý tưởng"
                : "AI đang tạo bài SEO hoàn chỉnh"}
          </p>
          <p className="text-xs text-white/75">
            Thời gian: {seconds}s · Có thể mất khoảng {duration} giây
          </p>
        </div>
        <span className="text-xl font-black">{progress}%</span>
      </div>
      <div className="p-4">
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, index) => {
            const complete = task.done || index < current,
              active = !task.done && index === current;
            return (
              <div
                key={step}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${complete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : active ? "border-violet-300 bg-violet-50 text-violet-700" : "border-slate-100 text-slate-400"}`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${complete ? "bg-emerald-500 text-white" : active ? "animate-pulse bg-violet-500 text-white" : "bg-slate-100"}`}
                >
                  {complete ? "✓" : index + 1}
                </span>
                {step}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
