import SwiftUI

struct CalendarioView: View {
    @EnvironmentObject private var store: FocusDataStore
    @State private var selectedDate: Date = Calendar.current.startOfDay(for: Date())
    @State private var showCreateEvent = false

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                Theme.Colors.background.ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                        header
                            .padding(.horizontal, Theme.Spacing.xl)
                            .padding(.top, Theme.Spacing.lg)

                        WeekDaySelector(
                            selectedDate: $selectedDate,
                            store: store
                        )
                        .padding(.horizontal, Theme.Spacing.xl)

                        dateDetailHeader
                            .padding(.horizontal, Theme.Spacing.xl)

                        dayContent
                            .padding(.horizontal, Theme.Spacing.xl)

                        Spacer(minLength: Theme.Spacing.bottomBarSafety)
                    }
                }

                floatingButton
                    .padding(.trailing, Theme.Spacing.xl)
                    .padding(.bottom, Theme.Spacing.bottomBarSafety - Theme.Spacing.xl)
            }
            .sheet(isPresented: $showCreateEvent) {
                NuevoEventoSheet(initialDate: selectedDate) { newEvent in
                    store.addEvent(newEvent)
                }
                .presentationDetents([.medium, .large])
                .presentationBackground(Theme.Colors.background)
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(monthYearLabel)
                .font(Theme.Typography.subhead)
                .foregroundStyle(Theme.Colors.textTertiary)
                .tracking(0.4)
            Text("Calendario")
                .font(Theme.Typography.title)
                .foregroundStyle(Theme.Colors.textPrimary)
        }
    }

    private var monthYearLabel: String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "es_ES")
        fmt.dateFormat = "MMMM yyyy"
        let raw = fmt.string(from: selectedDate)
        return raw.prefix(1).uppercased() + raw.dropFirst()
    }

    // MARK: - Día seleccionado

    private var dateDetailHeader: some View {
        let events = store.eventsFor(date: selectedDate)
        return HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(dayName)
                    .font(Theme.Typography.title2)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Text(eventsCountLabel)
                    .font(Theme.Typography.subhead)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
            Spacer()
            if !events.isEmpty {
                StatePill(
                    label: "\(events.count) evento\(events.count == 1 ? "" : "s")",
                    tint: Theme.Colors.focusAccent
                )
            }
        }
    }

    private var dayName: String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "es_ES")
        if Calendar.current.isDateInToday(selectedDate) { return "Hoy" }
        if Calendar.current.isDateInTomorrow(selectedDate) { return "Mañana" }
        fmt.dateFormat = "EEEE d"
        let raw = fmt.string(from: selectedDate)
        return raw.prefix(1).uppercased() + raw.dropFirst()
    }

    private var eventsCountLabel: String {
        let events = store.eventsFor(date: selectedDate)
        if events.isEmpty { return "Sin eventos." }
        if events.count == 1 { return "Un evento agendado." }
        return "\(events.count) eventos agendados."
    }

    // MARK: - Día detalle

    @ViewBuilder
    private var dayContent: some View {
        let events = store.eventsFor(date: selectedDate)
        if events.isEmpty {
            EmptyStateView(
                symbol: "calendar",
                title: "Día libre",
                message: "No tienes eventos en este día. Buen momento para foco o descanso.",
                actionLabel: "Nuevo evento",
                action: { showCreateEvent = true }
            )
            .frame(minHeight: 280)
        } else {
            VStack(spacing: Theme.Spacing.md) {
                ForEach(events) { event in
                    CalendarEventCard(event: event)
                }
            }
        }
    }

    // MARK: - FAB

    private var floatingButton: some View {
        Button {
            HapticManager.shared.tap()
            showCreateEvent = true
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Theme.Colors.textPrimary)
                .frame(width: 56, height: 56)
                .background(
                    Circle()
                        .fill(Theme.Colors.focusAccent)
                        .shadow(color: Theme.Colors.focusAccent.opacity(0.40), radius: 18, x: 0, y: 8)
                )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Week-day selector (scroll horizontal de 14 días)

private struct WeekDaySelector: View {
    @Binding var selectedDate: Date
    let store: FocusDataStore

    private let cal = Calendar.current

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Theme.Spacing.sm) {
                    ForEach(dayOffsets, id: \.self) { offset in
                        let date = cal.date(byAdding: .day, value: offset, to: cal.startOfDay(for: Date())) ?? Date()
                        DayPill(
                            date: date,
                            isSelected: cal.isDate(date, inSameDayAs: selectedDate),
                            eventsCount: store.eventsFor(date: date).count
                        ) {
                            withAnimation(.easeInOut(duration: 0.18)) {
                                selectedDate = cal.startOfDay(for: date)
                            }
                            HapticManager.shared.tick()
                        }
                        .id(offset)
                    }
                }
                .padding(.vertical, 2)
            }
            .onAppear {
                proxy.scrollTo(0, anchor: .leading)
            }
        }
    }

    private var dayOffsets: [Int] {
        Array(-2...11)
    }
}

private struct DayPill: View {
    let date: Date
    let isSelected: Bool
    let eventsCount: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Text(weekdayShort)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(isSelected ? Theme.Colors.textPrimary : Theme.Colors.textTertiary)
                    .tracking(0.6)
                Text("\(dayNumber)")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(isSelected ? Theme.Colors.textPrimary : Theme.Colors.textSecondary)
                Circle()
                    .fill(eventsCount > 0 ? (isSelected ? Theme.Colors.focusAccent : Theme.Colors.focusAccent.opacity(0.5)) : Color.clear)
                    .frame(width: 5, height: 5)
            }
            .frame(width: 48, height: 70)
            .background(
                RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                    .fill(isSelected ? Theme.Colors.surfaceHigh : Theme.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                            .strokeBorder(
                                isSelected ? Theme.Colors.focusAccent.opacity(0.45) : Theme.Colors.border,
                                lineWidth: Theme.Stroke.hairline
                            )
                    )
            )
        }
        .buttonStyle(.plain)
    }

    private var weekdayShort: String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "es_ES")
        fmt.dateFormat = "EEE"
        return fmt.string(from: date).uppercased()
    }

    private var dayNumber: Int {
        Calendar.current.component(.day, from: date)
    }
}

// MARK: - Card de evento (vista día)

private struct CalendarEventCard: View {
    let event: FocusEvent

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                Text(event.timeRangeLabel)
                    .font(Theme.Typography.timestamp)
                    .foregroundStyle(Theme.Colors.textPrimary)
                if let dur = event.durationLabel {
                    Text(dur)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textTertiary)
                }
            }
            .frame(width: 80, alignment: .leading)

            Rectangle()
                .fill(event.section.color)
                .frame(width: 3)
                .clipShape(Capsule())

            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text(event.title)
                    .font(Theme.Typography.bodyEmphasized)
                    .foregroundStyle(Theme.Colors.textPrimary)
                if let notes = event.notes, !notes.isEmpty {
                    Text(notes)
                        .font(Theme.Typography.subhead)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .lineLimit(2)
                }
                HStack(spacing: 6) {
                    StatePill(label: event.section.displayName, tint: event.section.color, symbol: event.section.symbol)
                    if let loc = event.location, !loc.isEmpty {
                        Image(systemName: "mappin")
                            .font(.system(size: 9))
                            .foregroundStyle(Theme.Colors.textTertiary)
                        Text(loc)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textTertiary)
                            .lineLimit(1)
                    }
                }
                .padding(.top, 2)
            }

            Spacer()
        }
        .padding(Theme.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                .fill(Theme.Colors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous)
                        .strokeBorder(Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
                )
        )
    }
}

// MARK: - Sheet de nuevo evento

private struct NuevoEventoSheet: View {
    @Environment(\.dismiss) private var dismiss
    let initialDate: Date
    let onSave: (FocusEvent) -> Void

    @State private var title: String = ""
    @State private var location: String = ""
    @State private var notes: String = ""
    @State private var date: Date
    @State private var startTime: Date
    @State private var endTime: Date
    @State private var section: EventSection = .reunion

    init(initialDate: Date, onSave: @escaping (FocusEvent) -> Void) {
        self.initialDate = initialDate
        self.onSave = onSave
        let cal = Calendar.current
        let baseDay = cal.startOfDay(for: initialDate)
        let nextHour = cal.date(bySettingHour: max(9, cal.component(.hour, from: Date()) + 1), minute: 0, second: 0, of: baseDay) ?? baseDay
        let oneHourLater = cal.date(byAdding: .hour, value: 1, to: nextHour) ?? nextHour
        _date = State(initialValue: baseDay)
        _startTime = State(initialValue: nextHour)
        _endTime = State(initialValue: oneHourLater)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.background.ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(spacing: Theme.Spacing.xl) {
                        // Título
                        sheetField(label: "TÍTULO") {
                            TextField("Reunión, foco, llamada…", text: $title, axis: .vertical)
                                .font(Theme.Typography.headline)
                                .foregroundStyle(Theme.Colors.textPrimary)
                                .tint(Theme.Colors.focusAccent)
                                .lineLimit(1...3)
                        }

                        // Día
                        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                            Text("DÍA").sectionLabelStyle()
                            DatePicker("", selection: $date, displayedComponents: .date)
                                .datePickerStyle(.compact)
                                .labelsHidden()
                                .tint(Theme.Colors.focusAccent)
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

                        // Horarios
                        HStack(spacing: Theme.Spacing.md) {
                            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                                Text("INICIO").sectionLabelStyle()
                                DatePicker("", selection: $startTime, displayedComponents: .hourAndMinute)
                                    .datePickerStyle(.compact)
                                    .labelsHidden()
                                    .tint(Theme.Colors.focusAccent)
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
                            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                                Text("FIN").sectionLabelStyle()
                                DatePicker("", selection: $endTime, displayedComponents: .hourAndMinute)
                                    .datePickerStyle(.compact)
                                    .labelsHidden()
                                    .tint(Theme.Colors.focusAccent)
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

                        // Categoría
                        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                            Text("TIPO").sectionLabelStyle()
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: Theme.Spacing.sm) {
                                    ForEach(EventSection.allCases) { s in
                                        sectionChip(s)
                                    }
                                }
                            }
                        }

                        // Ubicación
                        sheetField(label: "UBICACIÓN (OPCIONAL)") {
                            TextField("Sala, café, link…", text: $location)
                                .font(Theme.Typography.body)
                                .foregroundStyle(Theme.Colors.textPrimary)
                                .tint(Theme.Colors.focusAccent)
                        }

                        Spacer(minLength: Theme.Spacing.lg)
                    }
                    .padding(.horizontal, Theme.Spacing.xl)
                    .padding(.top, Theme.Spacing.md)
                }
            }
            .navigationTitle("Nuevo evento")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.Colors.background, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar", action: save)
                        .foregroundStyle(canSave ? Theme.Colors.focusAccent : Theme.Colors.textTertiary)
                        .disabled(!canSave)
                }
            }
        }
    }

    private func sectionChip(_ s: EventSection) -> some View {
        Button {
            HapticManager.shared.tick()
            section = s
        } label: {
            HStack(spacing: 4) {
                Image(systemName: s.symbol)
                    .font(.system(size: 11, weight: .semibold))
                Text(s.displayName)
                    .font(Theme.Typography.subheadEmphasized)
            }
            .foregroundStyle(section == s ? s.color : Theme.Colors.textSecondary)
            .padding(.horizontal, Theme.Spacing.md + 2)
            .padding(.vertical, Theme.Spacing.sm - 1)
            .background(
                Capsule()
                    .fill(section == s ? s.color.opacity(0.14) : Theme.Colors.surface)
                    .overlay(
                        Capsule()
                            .strokeBorder(section == s ? s.color.opacity(0.45) : Theme.Colors.border, lineWidth: Theme.Stroke.hairline)
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
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && endTime > startTime
    }

    private func save() {
        let cal = Calendar.current
        let dayStart = cal.startOfDay(for: date)

        func combine(_ time: Date) -> Date {
            let comps = cal.dateComponents([.hour, .minute], from: time)
            return cal.date(bySettingHour: comps.hour ?? 9, minute: comps.minute ?? 0, second: 0, of: dayStart) ?? dayStart
        }

        let event = FocusEvent(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            notes: notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : notes,
            startTime: combine(startTime),
            endTime: combine(endTime),
            section: section,
            location: location.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : location
        )
        onSave(event)
        dismiss()
    }
}

#Preview {
    CalendarioView()
        .environmentObject(FocusDataStore())
        .preferredColorScheme(.dark)
}
