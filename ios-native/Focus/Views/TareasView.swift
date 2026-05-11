import SwiftUI

private enum TaskFilter: String, CaseIterable, Identifiable {
    case all
    case pending
    case done
    case high

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: return "Todas"
        case .pending: return "Pendientes"
        case .done: return "Completadas"
        case .high: return "Alta prioridad"
        }
    }
}

struct TareasView: View {
    @EnvironmentObject private var store: FocusDataStore
    @State private var filter: TaskFilter = .pending
    @State private var showCreate = false
    @State private var expandedTaskIds: Set<UUID> = []

    /// Si el usuario no creó nada todavía, mostramos ejemplos.
    private var displayTasks: [FocusTask] {
        store.hasUserTasks ? store.tasks : DemoDataProvider.shared.exampleAllTasks()
    }

    private var showingExamples: Bool {
        !store.hasUserTasks
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.background.ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        header
                            .padding(.horizontal, Theme.Spacing.xl)
                            .padding(.top, Theme.Spacing.md)

                        filtersRow
                            .padding(.horizontal, Theme.Spacing.xl)

                        if hasAnyResult {
                            sectionsList
                                .padding(.horizontal, Theme.Spacing.xl)
                        } else {
                            EmptyStateView(
                                symbol: "checkmark.circle",
                                title: emptyTitle,
                                message: emptyMessage,
                                actionLabel: "Nueva tarea",
                                action: { showCreate = true }
                            )
                            .frame(minHeight: 320)
                        }

                        Spacer(minLength: Theme.Spacing.bottomBarSafety)
                    }
                }
            }
            .sheet(isPresented: $showCreate) {
                NuevaTareaSheet { newTask in
                    store.addTask(newTask)
                }
                .presentationDetents([.medium])
                .presentationBackground(Theme.Colors.background)
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Tareas")
                    .font(Theme.Typography.title)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Text(headerSubtitle)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .lineLimit(2)
            }
            Spacer()
            addButton
                .padding(.top, 4)
        }
    }

    private var addButton: some View {
        Button {
            HapticManager.shared.tap()
            showCreate = true
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 38, height: 38)
                .background(
                    Circle()
                        .fill(Theme.Colors.focusAccent)
                        .shadow(color: Theme.Colors.focusAccent.opacity(0.30), radius: 10, x: 0, y: 4)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Nueva tarea")
    }

    private var headerSubtitle: String {
        if showingExamples {
            return "Lo que tienes pendiente, en un solo lugar."
        }
        let pending = store.tasks.filter { !$0.done }.count
        if pending == 0 { return "No tienes pendientes. Disfruta el momento." }
        if pending == 1 { return "1 tarea pendiente. Vamos por ella." }
        return "\(pending) tareas pendientes. Una por una."
    }

    // MARK: - Filters

    private var filtersRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.sm) {
                ForEach(TaskFilter.allCases) { f in
                    FilterChip(label: f.label, isSelected: filter == f) {
                        filter = f
                    }
                }
            }
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var sectionsList: some View {
        VStack(spacing: Theme.Spacing.xl) {
            ForEach(TaskCategory.allCases) { cat in
                let cats = filteredTasks(in: cat)
                if !cats.isEmpty {
                    section(category: cat, tasks: cats)
                }
            }
        }
    }

    private func section(category: TaskCategory, tasks: [FocusTask]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            SectionHeader(title: category.displayName, trailing: "\(tasks.count)")

            VStack(spacing: Theme.Spacing.sm) {
                ForEach(tasks) { task in
                    TaskRowFull(
                        task: task,
                        isExpanded: expandedTaskIds.contains(task.id),
                        onToggle: { store.toggleTask(task.id) },
                        onToggleSubtask: { subId in
                            store.toggleSubtask(taskId: task.id, subtaskId: subId)
                        },
                        onExpand: { toggleExpand(task.id) }
                    )
                }
            }
        }
    }

    private func toggleExpand(_ id: UUID) {
        HapticManager.shared.tick()
        if expandedTaskIds.contains(id) {
            expandedTaskIds.remove(id)
        } else {
            expandedTaskIds.insert(id)
        }
    }

    // MARK: - Filtering

    private func filteredTasks(in category: TaskCategory) -> [FocusTask] {
        let base = displayTasks.filter { $0.category == category }
        switch filter {
        case .all: return base
        case .pending: return base.filter { !$0.done }
        case .done: return base.filter { $0.done }
        case .high: return base.filter { $0.priority == .alta }
        }
    }

    private var hasAnyResult: Bool {
        TaskCategory.allCases.contains { !filteredTasks(in: $0).isEmpty }
    }

    private var emptyTitle: String {
        switch filter {
        case .all: return "Sin tareas todavía"
        case .pending: return "Sin pendientes"
        case .done: return "Aún no completaste tareas"
        case .high: return "Sin tareas de alta prioridad"
        }
    }

    private var emptyMessage: String {
        switch filter {
        case .all: return "Crea tu primera tarea y la verás aquí."
        case .pending: return "Estás al día. Disfruta el momento o agrega una nueva."
        case .done: return "Cuando completes algo, va a aparecer aquí."
        case .high: return "Nada urgente por ahora."
        }
    }

}

// MARK: - Task row con subtareas

private struct TaskRowFull: View {
    let task: FocusTask
    let isExpanded: Bool
    let onToggle: () -> Void
    let onToggleSubtask: (UUID) -> Void
    let onExpand: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            mainRow
            if isExpanded && task.hasSubtasks {
                Divider()
                    .overlay(Theme.Colors.border)
                    .padding(.leading, Theme.Spacing.xxl + Theme.Spacing.md)
                subtasksList
                    .padding(.leading, Theme.Spacing.xxl + Theme.Spacing.md)
                    .padding(.trailing, Theme.Spacing.lg)
                    .padding(.vertical, Theme.Spacing.sm)
            }
        }
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                .fill(Theme.Colors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                        .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                )
                .focusCardShadow()
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous))
    }

    private var mainRow: some View {
        HStack(spacing: Theme.Spacing.md - 2) {
            Button(action: {
                HapticManager.shared.tap()
                onToggle()
            }) {
                Image(systemName: task.done ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 20, weight: .regular))
                    .foregroundStyle(task.done ? Theme.Colors.success : Theme.Colors.textTertiary)
                    .animation(.easeInOut(duration: 0.18), value: task.done)
            }
            .buttonStyle(.plain)

            // Priority como punto (no chip) — Things 3 style.
            Circle()
                .fill(task.priority.color)
                .frame(width: 7, height: 7)
                .opacity(task.done ? 0.4 : 1)

            VStack(alignment: .leading, spacing: 1) {
                Text(task.title)
                    .font(Theme.Typography.bodyEmphasized)
                    .foregroundStyle(task.done ? Theme.Colors.textTertiary : Theme.Colors.textPrimary)
                    .strikethrough(task.done, color: Theme.Colors.textTertiary)
                    .multilineTextAlignment(.leading)

                // Metadata solo si aplica — no ocupa altura cuando no hay nada.
                if task.dueLabel != nil || task.hasSubtasks {
                    HStack(spacing: 6) {
                        if let due = task.dueLabel {
                            Text(due)
                                .font(Theme.Typography.caption)
                                .foregroundStyle(Theme.Colors.textTertiary)
                        }
                        if task.dueLabel != nil && task.hasSubtasks {
                            Text("·").foregroundStyle(Theme.Colors.textQuaternary)
                        }
                        if task.hasSubtasks {
                            Text("\(task.completedSubtaskCount)/\(task.subtasks.count)")
                                .font(Theme.Typography.caption)
                                .foregroundStyle(Theme.Colors.textTertiary)
                        }
                    }
                }
            }

            Spacer()

            if task.hasSubtasks {
                Button(action: onExpand) {
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.Colors.textTertiary)
                        .padding(8)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.vertical, Theme.Spacing.sm + 2)
    }

    private var subtasksList: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            ForEach(task.subtasks) { sub in
                Button(action: { onToggleSubtask(sub.id) }) {
                    HStack(spacing: Theme.Spacing.sm) {
                        Image(systemName: sub.isCompleted ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 16))
                            .foregroundStyle(sub.isCompleted ? Theme.Colors.success : Theme.Colors.textTertiary)
                        Text(sub.title)
                            .font(Theme.Typography.subhead)
                            .foregroundStyle(sub.isCompleted ? Theme.Colors.textTertiary : Theme.Colors.textSecondary)
                            .strikethrough(sub.isCompleted, color: Theme.Colors.textTertiary)
                            .multilineTextAlignment(.leading)
                        Spacer()
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Sheet de nueva tarea

private struct NuevaTareaSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onSave: (FocusTask) -> Void

    @State private var title: String = ""
    @State private var notes: String = ""
    @State private var category: TaskCategory = .hoy
    @State private var priority: TaskPriority = .media

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.background.ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(spacing: Theme.Spacing.xl) {
                        sheetField(label: "TÍTULO") {
                            TextField("¿Qué quieres hacer?", text: $title, axis: .vertical)
                                .font(Theme.Typography.headline)
                                .foregroundStyle(Theme.Colors.textPrimary)
                                .tint(Theme.Colors.focusAccent)
                                .lineLimit(1...3)
                        }

                        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                            Text("CATEGORÍA").sectionLabelStyle()
                            HStack(spacing: Theme.Spacing.sm) {
                                ForEach(TaskCategory.allCases) { cat in
                                    FilterChip(label: cat.displayName, isSelected: category == cat) {
                                        category = cat
                                    }
                                }
                            }
                        }

                        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                            Text("PRIORIDAD").sectionLabelStyle()
                            HStack(spacing: Theme.Spacing.sm) {
                                ForEach(TaskPriority.allCases) { p in
                                    priorityChip(p)
                                }
                            }
                        }

                        sheetField(label: "NOTAS") {
                            TextField("Detalles, contexto…", text: $notes, axis: .vertical)
                                .font(Theme.Typography.body)
                                .foregroundStyle(Theme.Colors.textPrimary)
                                .tint(Theme.Colors.focusAccent)
                                .lineLimit(2...5)
                                .frame(minHeight: 70, alignment: .topLeading)
                        }

                        Spacer(minLength: Theme.Spacing.lg)
                    }
                    .padding(.horizontal, Theme.Spacing.xl)
                    .padding(.top, Theme.Spacing.md)
                }
            }
            .navigationTitle("Nueva tarea")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.Colors.background, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") {
                        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !trimmed.isEmpty else { return }
                        let task = FocusTask(
                            title: trimmed,
                            notes: notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : notes,
                            priority: priority,
                            category: category
                        )
                        onSave(task)
                        dismiss()
                    }
                    .foregroundStyle(canSave ? Theme.Colors.focusAccent : Theme.Colors.textTertiary)
                    .disabled(!canSave)
                }
            }
        }
    }

    private func priorityChip(_ p: TaskPriority) -> some View {
        Button {
            HapticManager.shared.tick()
            priority = p
        } label: {
            HStack(spacing: 6) {
                Image(systemName: p.symbol)
                    .font(.system(size: 11, weight: .semibold))
                Text(p.label)
                    .font(Theme.Typography.subheadEmphasized)
            }
            .foregroundStyle(priority == p ? .white : Theme.Colors.textSecondary)
            .padding(.horizontal, Theme.Spacing.md + 2)
            .padding(.vertical, Theme.Spacing.sm)
            .background(
                Capsule()
                    .fill(priority == p ? p.color : Theme.Colors.surface)
                    .overlay(
                        Capsule()
                            .strokeBorder(priority == p ? Color.clear : Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                    )
            )
        }
        .buttonStyle(.plain)
    }

    private func sheetField<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text(label).sectionLabelStyle()
            content()
                .padding(Theme.Spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                        .fill(Theme.Colors.surface)
                        .overlay(
                            RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                                .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                        )
                )
        }
    }

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

#Preview {
    TareasView()
        .environmentObject(FocusDataStore())
}
