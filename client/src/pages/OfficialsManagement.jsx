import { Link } from "react-router-dom";
import {
  BadgeCheck,
  ClipboardCheck,
  Headset,
  RadioTower,
  Shield,
  UsersRound,
} from "lucide-react";
import { officialRoles } from "../data/kabaddiProData";

// assignments should come from backend; keep empty and show unassigned state
const assignments = [];

const OfficialsManagement = () => {
  return (
    <div className="page-shell animate-fade-in">
      <header className="page-header">
        <div>
          <span className="eyebrow">Six-official distribution</span>
          <h1>Officials Command Center</h1>
          <p>
            Assign, verify, and route every referee, umpire, scorer, and
            assistant scorer to their match control panel.
          </p>
        </div>
        <Link className="btn btn-primary" to="/official/chief-referee">
          <RadioTower size={18} /> Open Live Control
        </Link>
      </header>

      <section className="ops-grid">
        <div className="metric-card">
          <Shield size={24} />
          <strong>6</strong>
          <span>Primary officials</span>
        </div>
        <div className="metric-card">
          <Headset size={24} />
          <strong>3</strong>
          <span>Decision stations</span>
        </div>
        <div className="metric-card">
          <ClipboardCheck size={24} />
          <strong>100%</strong>
          <span>Sheet coverage</span>
        </div>
        <div className="metric-card">
          <UsersRound size={24} />
          <strong>2</strong>
          <span>Revival queues</span>
        </div>
      </section>

      <section className="management-grid">
        {officialRoles.map((role, index) => (
          <article className="pro-card" key={role.id}>
            <div className="card-title-row">
              <div>
                <span className="eyebrow">Official {index + 1}</span>
                <h2>{role.title}</h2>
              </div>
              <BadgeCheck size={24} color="var(--accent)" />
            </div>
            <p className="muted">{role.authority}</p>
            <dl className="detail-list">
              <div>
                <dt>Station</dt>
                <dd>{role.station}</dd>
              </div>
              <div>
                <dt>Assigned</dt>
                <dd>
                  {assignments[index]?.name
                    ? `${assignments[index].name} · ${assignments[index].license}`
                    : "Unassigned"}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{assignments[index]?.status || "Pending assignment"}</dd>
              </div>
            </dl>
            <div className="tool-chips">
              {role.tools.map((tool) => (
                <span key={tool}>{tool}</span>
              ))}
            </div>
            <Link
              className="btn btn-secondary compact"
              to={`/official/${role.id}`}
            >
              Open Panel
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
};

export default OfficialsManagement;
