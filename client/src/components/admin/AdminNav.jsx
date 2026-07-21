/**
 * AdminNav — Vertical Sidebar Navigation
 *
 * Collapsible sidebar with:
 *   - Brand logo at top
 *   - Main nav links with icons (Overview, Dashboard, Users, Free Mock Tests)
 *   - Collapsible "Categories" section with default + draggable custom categories
 *   - Create User button
 *   - Profile dropdown at bottom
 *   - Collapse toggle
 *
 * All drag-and-drop reorder logic preserved from the original horizontal nav.
 */

import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useAdminCategories } from "../../context/CategoriesContext";
import api from "../../api/axios";
import toast from "react-hot-toast";
import ProfileDropdown from "./ProfileDropdown";

/* ─── Icons ─────────────────────────────────────────────────────── */
function OverviewIcon() {
  return (
    <svg className="sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg className="sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function FreeMockIcon() {
  return (
    <svg className="sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function ChatbotIcon() {
  return (
    <svg className="sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  );
}

function KeyPoolIcon() {
  return (
    <svg className="sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  );
}

function CategoryIcon() {
  return (
    <svg className="sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function DragIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

// ── Loading skeleton ──────────────────────────────────────────
function NavSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-3 mt-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-9 rounded-lg bg-white/5 animate-pulse" />
      ))}
    </div>
  );
}

// ── Single nav item ───────────────────────────────────────────
function SidebarNavItem({ to, end, icon, label, collapsed, badge }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `sidebar-nav-item ${isActive ? "sidebar-nav-active" : "sidebar-nav-idle"}`
      }
    >
      {icon}
      {!collapsed && <span className="sidebar-nav-label">{label}</span>}
      {!collapsed && badge && (
        <span className="ml-auto text-[10px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

// ── Category sub-item ─────────────────────────────────────────
function CategoryNavItem({ to, label, collapsed, onClose }) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      onClick={onClose}
      className={({ isActive }) =>
        `sidebar-cat-item group ${isActive ? "sidebar-cat-active" : "sidebar-cat-idle"}`
      }
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
        "bg-slate-500"
      }`} />
      {!collapsed && <span className="truncate text-[13px]">{label}</span>}
    </NavLink>
  );
}


export default function AdminNav({ collapsed, onToggleCollapse, onCreateUserClick }) {
  const { categories, loading, refreshCategories } = useAdminCategories();

  // Separate default (locked) from custom (draggable) categories
  const defaultCats = categories.filter((c) => !c.isDeletable);
  const [customCats, setCustomCats] = useState([]);
  const [catsOpen, setCatsOpen] = useState(true);

  // Sync customCats whenever the context list changes
  useEffect(() => {
    setCustomCats(categories.filter((c) => c.isDeletable));
  }, [categories]);

  // ── Drag end handler ────────────────────────────────────────
  async function handleDragEnd(result) {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;

    // Optimistic reorder
    const reordered = Array.from(customCats);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setCustomCats(reordered);

    // Build the order payload custom cats start after the locked defaults
    const baseOrder = defaultCats.length;
    const orderPayload = reordered.map((cat, idx) => ({
      slug: cat.slug,
      order: baseOrder + idx,
    }));

    try {
      await api.patch("/admin/categories/reorder", { order: orderPayload });
      refreshCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save order.");
      setCustomCats(categories.filter((c) => c.isDeletable));
    }
  }

  return (
    <aside
      className={`admin-sidebar ${collapsed ? "admin-sidebar-collapsed" : "admin-sidebar-expanded"}`}
      aria-label="Admin sidebar navigation"
    >
      {/* ── Brand header ──────────────────────────────────────── */}
      <div className="sidebar-brand">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center shrink-0">
            <span className="text-white font-black text-sm">P</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">Pakistan Mock</p>
              <p className="text-slate-400 text-[10px] font-medium uppercase tracking-widest">Admin</p>
            </div>
          )}
        </div>
        <button
          onClick={onToggleCollapse}
          className="sidebar-collapse-btn"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <CollapseIcon />
        </button>
      </div>

      {/* ── Main navigation ───────────────────────────────────── */}
      <nav className="sidebar-nav-section">
        {!collapsed && (
          <p className="sidebar-section-label">Main</p>
        )}

        <SidebarNavItem to="/admin" end icon={<OverviewIcon />} label="Overview" collapsed={collapsed} />
        <SidebarNavItem to="/admin/dashboard" end icon={<DashboardIcon />} label="Dashboard" collapsed={collapsed} />
        <SidebarNavItem to="/admin/users" icon={<UsersIcon />} label="Users" collapsed={collapsed} />
        <SidebarNavItem to="/admin/free-mock-tests" icon={<FreeMockIcon />} label="Free Mock Tests" collapsed={collapsed} />
        <SidebarNavItem to="/admin/chat-analytics" icon={<ChatbotIcon />} label="AI Chatbot" collapsed={collapsed} />
        <SidebarNavItem to="/admin/api-keys" icon={<KeyPoolIcon />} label="Key Pool" collapsed={collapsed} />
      </nav>

      {/* ── Categories section ────────────────────────────────── */}
      <div className="sidebar-nav-section border-t border-white/5 pt-3">
        {!collapsed ? (
          <button
            onClick={() => setCatsOpen((o) => !o)}
            className="sidebar-section-toggle"
          >
            <span className="sidebar-section-label mb-0">Categories</span>
            <ChevronIcon open={catsOpen} />
          </button>
        ) : (
          <div className="px-2 mb-2">
            <div className="w-full h-px bg-white/10" />
          </div>
        )}

        {loading ? (
          <NavSkeleton />
        ) : (
          (catsOpen || collapsed) && (
            <div className="sidebar-cats-list">
              {/* Default categories */}
              {defaultCats.map((cat) => (
                <CategoryNavItem
                  key={cat._id}
                  to={`/admin/dashboard/category/${cat.slug}`}
                  label={cat.name}
                  collapsed={collapsed}
                />
              ))}

              {/* Custom categories (draggable) */}
              {customCats.length > 0 && !collapsed && (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="sidebar-custom-cats" direction="vertical">
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {customCats.map((cat, index) => (
                          <Draggable key={cat._id} draggableId={cat._id} index={index}>
                            {(draggable, snapshot) => (
                              <div
                                ref={draggable.innerRef}
                                {...draggable.draggableProps}
                                {...draggable.dragHandleProps}
                                className={`group flex items-center ${
                                  snapshot.isDragging ? "opacity-80 ring-1 ring-brand/40 rounded-lg bg-white/5" : ""
                                }`}
                              >
                                <DragIcon />
                                <CategoryNavItem
                                  to={`/admin/dashboard/category/${cat.slug}`}
                                  label={cat.name}
                                  collapsed={collapsed}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}

              {/* Collapsed mode: just list custom cats without drag */}
              {customCats.length > 0 && collapsed && (
                customCats.map((cat) => (
                  <CategoryNavItem
                    key={cat._id}
                    to={`/admin/dashboard/category/${cat.slug}`}
                    label={cat.name}
                    collapsed={collapsed}
                  />
                ))
              )}
            </div>
          )
        )}
      </div>

      {/* ── Spacer ────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Bottom actions ─────────────────────────────────────── */}
      <div className="sidebar-bottom">
        {/* Create User button */}
        <button
          onClick={onCreateUserClick}
          className={`sidebar-create-btn ${collapsed ? "sidebar-create-btn-collapsed" : ""}`}
          title={collapsed ? "Create User Login" : undefined}
        >
          <PlusIcon />
          {!collapsed && <span>Create User</span>}
        </button>

        {/* Profile */}
        <div className={`sidebar-profile ${collapsed ? "justify-center" : ""}`}>
          <ProfileDropdown collapsed={collapsed} />
        </div>
      </div>
    </aside>
  );
}
