import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { clientsApi, regionsApi } from "../api/crmApi";
import { useAuth } from "../auth/AuthContext";
import Pagination from "../components/Pagination";
import StatusBadge from "../components/StatusBadge";
import VisitTypeBadge from "../components/VisitTypeBadge";
import { formatDate } from "../utils/formatters";

const tabs = [
  { key: "WEEKLY", label: "أسبوعي" },
  { key: "BIWEEKLY", label: "كل أسبوعين" },
  { key: "MONTHLY", label: "شهري" },
  { key: "NO_ANSWER", label: "لم يرد" },
  { key: "REJECTED", label: "مرفوض" }
];

const initialCreateForm = {
  name: "",
  phone: "",
  address: "",
  regionId: "",
  products: "",
  visitType: "WEEKLY",
  status: "ACTIVE",
  nextVisitDate: ""
};

function mapTabToFilters(tab) {
  if (tab === "NO_ANSWER") {
    return { status: "NO_ANSWER" };
  }

  if (tab === "REJECTED") {
    return { status: "REJECTED" };
  }

  return {
    status: "ACTIVE",
    visitType: tab
  };
}

export default function ClientsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [regions, setRegions] = useState([]);
  const [activeTab, setActiveTab] = useState("WEEKLY");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [data, setData] = useState({ items: [], totalPages: 1, total: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionClientId, setActionClientId] = useState(null);
  const [deleteClientId, setDeleteClientId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [createLoading, setCreateLoading] = useState(false);

  const queryFilters = useMemo(() => mapTabToFilters(activeTab), [activeTab]);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        page,
        pageSize: 20,
        search: search || undefined,
        ...queryFilters
      };

      if (isAdmin && selectedRegionId) {
        params.regionId = Number(selectedRegionId);
      }

      const response = await clientsApi.list(params);
      setData(response.data);
    } catch (err) {
      setError(err.message || "تعذر تحميل العملاء");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page, queryFilters, search, selectedRegionId]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    let mounted = true;

    async function loadRegions() {
      try {
        const response = await regionsApi.list();
        if (mounted) {
          setRegions(response.data.items || []);
        }
      } catch (err) {
        // Regions filter is optional on this page.
      }
    }

    loadRegions();

    return () => {
      mounted = false;
    };
  }, [isAdmin]);

  async function handleClientAction(clientId) {
    setActionClientId(clientId);

    try {
      await clientsApi.handle(clientId, {
        outcome: "ACTIVE",
        note: "تم التعامل مع العميل"
      });
      await loadClients();
    } catch (err) {
      setError(err.message || "تعذر تحديث حالة العميل");
    } finally {
      setActionClientId(null);
    }
  }

  async function handleDeleteClient(client) {
    const confirmed = window.confirm(`هل تريد حذف العميل "${client.name}"؟`);
    if (!confirmed) {
      return;
    }

    setDeleteClientId(client.id);
    setError("");

    try {
      await clientsApi.remove(client.id);
      await loadClients();
    } catch (err) {
      setError(err.message || "تعذر حذف العميل");
    } finally {
      setDeleteClientId(null);
    }
  }

  async function handleCreateClient(event) {
    event.preventDefault();
    setCreateLoading(true);
    setError("");

    try {
      await clientsApi.create({
        name: createForm.name,
        phone: createForm.phone,
        address: createForm.address,
        regionId: Number(createForm.regionId),
        products: createForm.products,
        visitType: createForm.visitType,
        status: createForm.status,
        nextVisitDate: createForm.nextVisitDate ? `${createForm.nextVisitDate}T00:00:00.000Z` : undefined
      });

      setCreateForm(initialCreateForm);
      setShowCreate(false);
      await loadClients();
    } catch (err) {
      setError(err.message || "تعذر إضافة العميل");
    } finally {
      setCreateLoading(false);
    }
  }

  function onTabChange(nextTab) {
    setActiveTab(nextTab);
    setPage(1);
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-header split">
          <h3>العملاء</h3>
          {isAdmin && (
            <button type="button" className="primary-btn" onClick={() => setShowCreate((prev) => !prev)}>
              {showCreate ? "إغلاق نموذج الإضافة" : "إضافة عميل"}
            </button>
          )}
        </div>

        {isAdmin && showCreate && (
          <form className="form-grid create-form" onSubmit={handleCreateClient}>
            <label>
              اسم العميل
              <input
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>
            <label>
              رقم الهاتف
              <input
                value={createForm.phone}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))}
                required
              />
            </label>
            <label>
              العنوان
              <input
                value={createForm.address}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, address: event.target.value }))}
                required
              />
            </label>
            <label>
              المنطقة
              <select
                value={createForm.regionId}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, regionId: event.target.value }))}
                required
              >
                <option value="">اختر المنطقة</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              المنتجات
              <input
                value={createForm.products}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, products: event.target.value }))}
                required
              />
            </label>
            <label>
              نوع الزيارة
              <select
                value={createForm.visitType}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, visitType: event.target.value }))}
              >
                <option value="WEEKLY">أسبوعي</option>
                <option value="BIWEEKLY">كل أسبوعين</option>
                <option value="MONTHLY">شهري</option>
              </select>
            </label>
            <label>
              الحالة
              <select
                value={createForm.status}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, status: event.target.value }))}
              >
                <option value="ACTIVE">نشط</option>
                <option value="NO_ANSWER">لم يرد</option>
                <option value="REJECTED">رفض التعامل</option>
              </select>
            </label>
            <label>
              تاريخ الزيارة القادمة
              <input
                type="date"
                value={createForm.nextVisitDate}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, nextVisitDate: event.target.value }))}
              />
            </label>
            <button type="submit" className="primary-btn" disabled={createLoading}>
              {createLoading ? "جارٍ الحفظ..." : "حفظ العميل"}
            </button>
          </form>
        )}

        <div className="tabs-row">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? "tab-btn active" : "tab-btn"}
              onClick={() => onTabChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="filters-row">
          <input
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="بحث بالاسم أو الهاتف أو العنوان..."
          />

          {isAdmin && (
            <select
              value={selectedRegionId}
              onChange={(event) => {
                setSelectedRegionId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">كل المناطق</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          )}

          <button type="button" className="secondary-btn" onClick={loadClients}>
            تحديث
          </button>
        </div>

        {error && <div className="error-box">{error}</div>}

        {loading ? (
          <div className="table-empty">جاري تحميل العملاء...</div>
        ) : data.items.length === 0 ? (
          <div className="table-empty">لا توجد بيانات في هذا التصنيف</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>الهاتف</th>
                  <th>العنوان</th>
                  <th>المنطقة</th>
                  <th>المنتجات</th>
                  <th>الزيارة</th>
                  <th>الحالة</th>
                  <th>الزيارة القادمة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((client) => (
                  <tr key={client.id}>
                    <td>{client.name}</td>
                    <td>{client.phone}</td>
                    <td>{client.address}</td>
                    <td>{client.region?.name}</td>
                    <td>{client.products}</td>
                    <td>
                      <VisitTypeBadge type={client.visitType} />
                    </td>
                    <td>
                      <StatusBadge status={client.status} />
                    </td>
                    <td>{formatDate(client.nextVisitDate)}</td>
                    <td className="actions-cell">
                      <Link className="ghost-btn" to={`/clients/${client.id}`}>
                        التفاصيل
                      </Link>
                      {client.status !== "REJECTED" && (
                        <button
                          type="button"
                          className="primary-btn"
                          disabled={actionClientId === client.id}
                          onClick={() => handleClientAction(client.id)}
                        >
                          {actionClientId === client.id ? "جاري..." : "تم التعامل"}
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          type="button"
                          className="danger-btn"
                          disabled={deleteClientId === client.id}
                          onClick={() => handleDeleteClient(client)}
                        >
                          {deleteClientId === client.id ? "جاري الحذف..." : "حذف"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
      </section>
    </div>
  );
}