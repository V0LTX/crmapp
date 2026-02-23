import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dashboardApi } from "../api/crmApi";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      setLoading(true);
      setError("");

      try {
        const response = await dashboardApi.getSummary();
        if (mounted) {
          setData(response.data);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || "تعذر تحميل لوحة التحكم");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSummary();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div className="panel">جاري تحميل لوحة التحكم...</div>;
  }

  if (error) {
    return <div className="panel error-box">{error}</div>;
  }

  return (
    <div className="stack">
      <section className="metrics-grid">
        <article className="metric-card">
          <h3>إجمالي العملاء</h3>
          <strong>{data?.totals?.totalClients || 0}</strong>
        </article>
        <article className="metric-card">
          <h3>عملاء مستحقون اليوم</h3>
          <strong>{data?.totals?.dueClients || 0}</strong>
        </article>
        <article className="metric-card">
          <h3>لم يرد</h3>
          <strong>{data?.totals?.noAnswerClients || 0}</strong>
        </article>
        <article className="metric-card">
          <h3>مرفوض</h3>
          <strong>{data?.totals?.rejectedClients || 0}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>المناطق</h3>
          <p>6 مناطق ثابتة مع أعداد العملاء والمندوبين</p>
        </div>

        <div className="regions-grid">
          {data?.regions?.map((region) => (
            <article key={region.id} className="region-card">
              <h4>{region.name}</h4>
              <ul>
                <li>عدد العملاء: {region.clientsCount}</li>
                <li>عدد المندوبين: {region.representativesCount}</li>
                <li>عملاء مستحقون: {region.dueClientsCount}</li>
                <li>لم يرد: {region.noAnswerCount}</li>
              </ul>
              <button type="button" className="primary-btn" onClick={() => navigate(`/regions/${region.id}`)}>
                عرض المنطقة
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
