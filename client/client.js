/**
 * Browser half of dsh-tag.
 *
 * - Colors session and workspace titles with generated CSS rules keyed by the
 *   stable `data-row-key` attribute (no DOM mutation per row).
 * - Adds a "Tags" submenu to the session and workspace context menus. Each row
 *   carries one tag: click to apply, click the checked tag to remove.
 * - Settings page renames, recolors and deletes tags.
 * - The colour bar above the session list filters sessions; it uses the
 *   `workspaces`/`sessions` services to open matching groups and hide empty
 *   ones, then hides non-matching rows with generated CSS.
 *
 * Reads `/tags`; mutations go to `/tags/...` with the dsh browser session.
 */
window.__ModuleLoader__.load({
  id: 'dsh-tag',
  factory(require) {
    const React = require('react')
    const { Switch } = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement

    const NS = 'dshTag'
    const TITLE = 'DSH Tag'
    const API = '/tags'
    const EVENTS = '/tags/events'
    const MAX_TAGS = 10
    const HEX_COLOR = /^#[0-9a-f]{6}$/i
    const TAG_PATH = 'M2.5 2.5h6.1l4.9 4.9a1.2 1.2 0 0 1 0 1.7l-3.2 3.2a1.2 1.2 0 0 1-1.7 0L2.5 8.6V2.5z'

    /**
     * One palette, two renderings: the fixed hex is used by swatches, dots and
     * the filter bar; the text token switches with the theme via CSS.
     */
    const COLORS = {
      green: { hex: '#22C55E', text: 'var(--dsh-tag-text-green)' },
      amber: { hex: '#F59E0B', text: 'var(--dsh-tag-text-amber)' },
      blue: { hex: '#3B82F6', text: 'var(--dsh-tag-text-blue)' },
      red: { hex: '#EF4444', text: 'var(--dsh-tag-text-red)' },
      purple: { hex: '#A855F7', text: 'var(--dsh-tag-text-purple)' },
      gray: { hex: '#6B7280', text: 'var(--dsh-tag-text-gray)' },
      teal: { hex: '#06B6D4', text: 'var(--dsh-tag-text-teal)' },
      pink: { hex: '#EC4899', text: 'var(--dsh-tag-text-pink)' },
      indigo: { hex: '#4F46E5', text: 'var(--dsh-tag-text-indigo)' },
      brown: { hex: '#8D5B3E', text: 'var(--dsh-tag-text-brown)' },
    }
    const SWATCHES = Object.keys(COLORS)

    const zh = {
      menuSession: '标签',
      menuWorkspace: '工作区标签',
      clear: '清除标签',
      noTags: '还没有标签，先去 设置 → DSH Tag 创建',
      newPlaceholder: '新标签文字…',
      add: '添加',
      remove: '删除',
      confirmDelete: '删除标签「{label}」？对应标记也会清除。',
      empty: '还没有标签，先创建一个。',
      failed: '标签操作失败',
      limit: '最多支持 10 个标签',
      noColors: '没有可用的颜色了',
      cycleColor: '切换颜色',
      color: '颜色',
      filterAll: '全部',
      filterTitle: '按标签过滤会话',
      filterEmpty: '没有带「{label}」标签的会话',
      workspaceEmpty: '「{label}」标在工作区上；这个工作区下暂无会话',
      clearFilter: '清除过滤',
      emptyHint: '换个标签，或清除过滤查看全部会话。',
      showFilter: '显示过滤条',
      filterDesc: '在工作区列表上方显示标签颜色过滤条。',
      filterFailed: '过滤条设置没有保存',
      colorGreen: '绿色',
      colorAmber: '橙色',
      colorBlue: '蓝色',
      colorRed: '红色',
      colorPurple: '紫色',
      colorGray: '灰色',
      colorTeal: '青色',
      colorPink: '粉色',
      colorIndigo: '靛蓝',
      colorBrown: '棕色',
    }

    const en = {
      menuSession: 'Tags',
      menuWorkspace: 'Workspace tags',
      clear: 'Clear tag',
      noTags: 'No tags yet — create one in Settings → DSH Tag',
      newPlaceholder: 'New tag label…',
      add: 'Add',
      remove: 'Delete',
      confirmDelete: 'Delete “{label}”? Its assignments will be cleared.',
      empty: 'No tags yet — create one below.',
      failed: 'Tag update failed',
      limit: 'At most 10 tags are supported',
      noColors: 'No colors left',
      cycleColor: 'Change color',
      color: 'Color',
      filterAll: 'All',
      filterTitle: 'Filter sessions by tag',
      filterEmpty: 'No sessions tagged “{label}”',
      workspaceEmpty: '“{label}” is on a workspace; it holds no sessions yet',
      clearFilter: 'Clear filter',
      emptyHint: 'Try another tag, or clear the filter to see everything.',
      showFilter: 'Show filter bar',
      filterDesc: 'Show the tag colour filters above the workspace list.',
      filterFailed: 'The filter bar setting was not saved',
      colorGreen: 'Green',
      colorAmber: 'Amber',
      colorBlue: 'Blue',
      colorRed: 'Red',
      colorPurple: 'Purple',
      colorGray: 'Gray',
      colorTeal: 'Teal',
      colorPink: 'Pink',
      colorIndigo: 'Indigo',
      colorBrown: 'Brown',
    }

    const ja = {
      menuSession: 'タグ',
      menuWorkspace: 'ワークスペースのタグ',
      clear: 'タグを解除',
      noTags: 'タグがまだありません。「設定 → DSH Tag」で作成できます',
      newPlaceholder: '新しいタグ名…',
      add: '追加',
      remove: '削除',
      confirmDelete: '「{label}」を削除しますか？付いているタグもすべて解除されます。',
      empty: 'タグがまだありません。下から作成してください。',
      failed: 'タグを更新できませんでした',
      limit: 'タグは最大 10 個までです',
      noColors: '使える色がなくなりました',
      cycleColor: '色を変える',
      color: '色',
      filterAll: 'すべて',
      filterTitle: 'タグでセッションを絞り込む',
      filterEmpty: '「{label}」の付いたセッションはありません',
      workspaceEmpty: '「{label}」はこのワークスペースに付いていますが、セッションはまだありません',
      clearFilter: 'フィルターを解除',
      emptyHint: '別のタグを選ぶか、フィルターを解除するとすべて表示されます。',
      showFilter: 'フィルターバーを表示',
      filterDesc: 'ワークスペース一覧の上にタグの色フィルターを表示します。',
      filterFailed: 'フィルター設定を保存できませんでした',
      colorGreen: '緑',
      colorAmber: 'オレンジ',
      colorBlue: '青',
      colorRed: '赤',
      colorPurple: '紫',
      colorGray: 'グレー',
      colorTeal: '青緑',
      colorPink: 'ピンク',
      colorIndigo: '藍色',
      colorBrown: '茶色',
    }

    const es = {
      menuSession: 'Etiquetas',
      menuWorkspace: 'Etiquetas del espacio de trabajo',
      clear: 'Quitar etiqueta',
      noTags: 'Aún no hay etiquetas; créala en Ajustes → DSH Tag',
      newPlaceholder: 'Nombre de la nueva etiqueta…',
      add: 'Añadir',
      remove: 'Eliminar',
      confirmDelete: '¿Eliminar «{label}»? También se quitará de todo lo que la use.',
      empty: 'Aún no hay etiquetas; crea una abajo.',
      failed: 'No se pudo actualizar la etiqueta',
      limit: 'Se admiten 10 etiquetas como máximo',
      noColors: 'No quedan colores disponibles',
      cycleColor: 'Cambiar color',
      color: 'Color',
      filterAll: 'Todas',
      filterTitle: 'Filtrar sesiones por etiqueta',
      filterEmpty: 'Ninguna sesión tiene «{label}»',
      workspaceEmpty: '«{label}» está en este espacio de trabajo, pero aún no tiene sesiones',
      clearFilter: 'Quitar filtro',
      emptyHint: 'Prueba otra etiqueta o quita el filtro para verlo todo.',
      showFilter: 'Mostrar barra de filtros',
      filterDesc: 'Muestra los filtros de color sobre la lista de espacios de trabajo.',
      filterFailed: 'No se pudo guardar el ajuste de la barra de filtros',
      colorGreen: 'Verde',
      colorAmber: 'Ámbar',
      colorBlue: 'Azul',
      colorRed: 'Rojo',
      colorPurple: 'Morado',
      colorGray: 'Gris',
      colorTeal: 'Turquesa',
      colorPink: 'Rosa',
      colorIndigo: 'Índigo',
      colorBrown: 'Marrón',
    }

    const fr = {
      menuSession: 'Étiquettes',
      menuWorkspace: 'Étiquettes de l’espace de travail',
      clear: 'Retirer l’étiquette',
      noTags: 'Pas encore d’étiquette — créez-en une dans Réglages → DSH Tag',
      newPlaceholder: 'Nom de la nouvelle étiquette…',
      add: 'Ajouter',
      remove: 'Supprimer',
      confirmDelete: 'Supprimer « {label} » ? Elle sera aussi retirée partout où elle est utilisée.',
      empty: 'Aucune étiquette pour l’instant — créez-en une ci-dessous.',
      failed: 'Impossible de mettre à jour l’étiquette',
      limit: '10 étiquettes maximum',
      noColors: 'Plus aucune couleur disponible',
      cycleColor: 'Changer la couleur',
      color: 'Couleur',
      filterAll: 'Toutes',
      filterTitle: 'Filtrer les sessions par étiquette',
      filterEmpty: 'Aucune session étiquetée « {label} »',
      workspaceEmpty: '« {label} » est sur cet espace de travail, mais il ne contient encore aucune session',
      clearFilter: 'Retirer le filtre',
      emptyHint: 'Essayez une autre étiquette ou retirez le filtre pour tout afficher.',
      showFilter: 'Afficher la barre de filtres',
      filterDesc: 'Affiche les filtres de couleur au-dessus de la liste des espaces de travail.',
      filterFailed: 'Le réglage de la barre de filtres n’a pas été enregistré',
      colorGreen: 'Vert',
      colorAmber: 'Ambre',
      colorBlue: 'Bleu',
      colorRed: 'Rouge',
      colorPurple: 'Violet',
      colorGray: 'Gris',
      colorTeal: 'Turquoise',
      colorPink: 'Rose',
      colorIndigo: 'Indigo',
      colorBrown: 'Brun',
    }

    const de = {
      menuSession: 'Tags',
      menuWorkspace: 'Workspace-Tags',
      clear: 'Tag entfernen',
      noTags: 'Noch keine Tags – lege sie unter Einstellungen → DSH Tag an',
      newPlaceholder: 'Name des neuen Tags…',
      add: 'Hinzufügen',
      remove: 'Löschen',
      confirmDelete: '„{label}“ löschen? Der Tag wird überall entfernt, wo er gesetzt ist.',
      empty: 'Noch keine Tags – lege unten einen an.',
      failed: 'Tag konnte nicht aktualisiert werden',
      limit: 'Höchstens 10 Tags',
      noColors: 'Keine Farben mehr frei',
      cycleColor: 'Farbe ändern',
      color: 'Farbe',
      filterAll: 'Alle',
      filterTitle: 'Sitzungen nach Tag filtern',
      filterEmpty: 'Keine Sitzung mit dem Tag „{label}“',
      workspaceEmpty: '„{label}“ liegt auf diesem Workspace, der noch keine Sitzungen enthält',
      clearFilter: 'Filter entfernen',
      emptyHint: 'Wähle einen anderen Tag oder entferne den Filter, um alles zu sehen.',
      showFilter: 'Filterleiste anzeigen',
      filterDesc: 'Zeigt die Tag-Farbfilter über der Workspace-Liste.',
      filterFailed: 'Die Filterleisten-Einstellung wurde nicht gespeichert',
      colorGreen: 'Grün',
      colorAmber: 'Orange',
      colorBlue: 'Blau',
      colorRed: 'Rot',
      colorPurple: 'Violett',
      colorGray: 'Grau',
      colorTeal: 'Türkis',
      colorPink: 'Rosa',
      colorIndigo: 'Indigo',
      colorBrown: 'Braun',
    }

    const ru = {
      menuSession: 'Метки',
      menuWorkspace: 'Метки рабочего пространства',
      clear: 'Снять метку',
      noTags: 'Меток пока нет — создайте в «Настройки → DSH Tag»',
      newPlaceholder: 'Название новой метки…',
      add: 'Добавить',
      remove: 'Удалить',
      confirmDelete: 'Удалить метку «{label}»? Она также снимется со всех элементов.',
      empty: 'Меток пока нет — создайте ниже.',
      failed: 'Не удалось обновить метку',
      limit: 'Не более 10 меток',
      noColors: 'Свободных цветов не осталось',
      cycleColor: 'Сменить цвет',
      color: 'Цвет',
      filterAll: 'Все',
      filterTitle: 'Фильтровать сессии по метке',
      filterEmpty: 'Нет сессий с меткой «{label}»',
      workspaceEmpty: 'На этом рабочем пространстве стоит «{label}», но сессий пока нет',
      clearFilter: 'Снять фильтр',
      emptyHint: 'Выберите другую метку или снимите фильтр, чтобы увидеть всё.',
      showFilter: 'Показывать панель фильтров',
      filterDesc: 'Показывает цветные фильтры меток над списком рабочих пространств.',
      filterFailed: 'Настройка панели фильтров не сохранилась',
      colorGreen: 'Зелёный',
      colorAmber: 'Янтарный',
      colorBlue: 'Синий',
      colorRed: 'Красный',
      colorPurple: 'Фиолетовый',
      colorGray: 'Серый',
      colorTeal: 'Бирюзовый',
      colorPink: 'Розовый',
      colorIndigo: 'Индиго',
      colorBrown: 'Коричневый',
    }

    const pt = {
      menuSession: 'Etiquetas',
      menuWorkspace: 'Etiquetas do espaço de trabalho',
      clear: 'Remover etiqueta',
      noTags: 'Ainda não há etiquetas — crie em Configurações → DSH Tag',
      newPlaceholder: 'Nome da nova etiqueta…',
      add: 'Adicionar',
      remove: 'Excluir',
      confirmDelete: 'Excluir “{label}”? Ela também será removida de tudo o que a usa.',
      empty: 'Ainda sem etiquetas — crie uma abaixo.',
      failed: 'Não foi possível atualizar a etiqueta',
      limit: 'No máximo 10 etiquetas',
      noColors: 'Não há mais cores disponíveis',
      cycleColor: 'Mudar cor',
      color: 'Cor',
      filterAll: 'Todas',
      filterTitle: 'Filtrar sessões por etiqueta',
      filterEmpty: 'Nenhuma sessão com “{label}”',
      workspaceEmpty: '“{label}” está neste espaço de trabalho, que ainda não tem sessões',
      clearFilter: 'Remover filtro',
      emptyHint: 'Tente outra etiqueta ou remova o filtro para ver tudo.',
      showFilter: 'Mostrar barra de filtros',
      filterDesc: 'Mostra os filtros de cor acima da lista de espaços de trabalho.',
      filterFailed: 'A configuração da barra de filtros não foi salva',
      colorGreen: 'Verde',
      colorAmber: 'Âmbar',
      colorBlue: 'Azul',
      colorRed: 'Vermelho',
      colorPurple: 'Roxo',
      colorGray: 'Cinza',
      colorTeal: 'Turquesa',
      colorPink: 'Rosa',
      colorIndigo: 'Índigo',
      colorBrown: 'Marrom',
    }

    const CSS = `
/* Title text needs its own pairs: the shared state-*-primary tokens keep a
   500-level fill color in both themes, which is too light on white and too
   dim on the dark surface. Each pair clears 4.8:1 against its own background. */
:root{
  --dsh-tag-text-green:#15803D;
  --dsh-tag-text-amber:#B45309;
  --dsh-tag-text-blue:#1D4ED8;
  --dsh-tag-text-red:#DC2626;
  --dsh-tag-text-purple:#7C3AED;
  --dsh-tag-text-gray:#4B5563;
  --dsh-tag-text-teal:#0F766E;
  --dsh-tag-text-pink:#BE185D;
  --dsh-tag-text-indigo:#4338CA;
  --dsh-tag-text-brown:#7C4A21;
}
body[data-ds-dark-theme]{
  --dsh-tag-text-green:#4ADE80;
  --dsh-tag-text-amber:#FBBF24;
  --dsh-tag-text-blue:#7AA9FF;
  --dsh-tag-text-red:#F87171;
  --dsh-tag-text-purple:#A78BFA;
  --dsh-tag-text-gray:#9CA3AF;
  --dsh-tag-text-teal:#2DD4BF;
  --dsh-tag-text-pink:#F472B6;
  --dsh-tag-text-indigo:#818CF8;
  --dsh-tag-text-brown:#C9A57A;
}
.dsh-tag-error{margin:8px 0;font-size:12px;line-height:17px;color:var(--dsw-alias-state-error-primary,#e5484d)}
.dsh-tag-dot{flex:none;width:9px;height:9px;border-radius:50%;display:inline-block}
.dsh-tag-input{flex:1;min-width:120px;box-sizing:border-box;height:34px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l4,rgba(127,127,127,.3));background:var(--dsw-alias-button-elevated-fill,rgba(127,127,127,.06));color:inherit;font:inherit;outline:none}
.dsh-tag-input:focus{border-color:var(--dsw-alias-state-business-primary,#3d7bfd)}
.dsh-tag-swatch{position:relative;width:20px;height:20px;padding:0;border:0;border-radius:50%;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
.dsh-tag-swatch.is-current{box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
.dsh-tag-swatch.is-current::after{content:'✓';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;line-height:1;text-shadow:0 1px 1px rgba(0,0,0,.45)}
.dsh-tag-swatch.is-used{opacity:.22;cursor:not-allowed}
.dsh-tag-dotWrap{position:relative;display:flex;align-items:center;flex:none}
.dsh-tag-pickerButton{display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:7px;background:transparent;cursor:pointer}
.dsh-tag-pickerButton:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.08))}
.dsh-tag-pickerButton:disabled{cursor:default;opacity:.45}
.dsh-tag-pickerButton .dsh-tag-dot{width:20px;height:20px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
.dsh-tag-colorMenu{position:absolute;top:calc(100% + 4px);left:0;z-index:30;display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;background:var(--dsw-alias-surface-primary,#fff);border:1px solid var(--dsw-alias-border-l3,rgba(127,127,127,.22));box-shadow:0 8px 20px rgba(0,0,0,.14)}
.dsh-tag-colorMenu.is-right{left:auto;right:0}
.dsh-tag-hint{margin:0;padding:0 2px;font-size:12px;color:var(--dsw-alias-label-tertiary,#888)}
.dsh-tag-primary{height:32px;padding:0 14px;border:0;border-radius:8px;background:var(--dsw-alias-state-business-primary,#3d7bfd);color:#fff;font:inherit;font-size:13px;cursor:pointer}
.dsh-tag-primary:disabled{opacity:.45;cursor:default}
.dsh-tag-delete{display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary,#888);cursor:pointer}
.dsh-tag-delete:hover{background:var(--dsw-alias-state-error-primary,#e5484d);color:#fff}
.dsh-tag-delete:disabled{opacity:.45;cursor:default}
.dsh-tag-create{box-sizing:border-box;display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:100%;min-height:44px;padding:8px 14px;border:1px dashed var(--dsh-tag-frame,var(--dsw-alias-border-l3,rgba(127,127,127,.32)));border-radius:12px;background:transparent}
.dsh-tag-create .dsh-tag-input{flex:1;min-width:140px;border:0;background:transparent;outline:none}
.dsh-tag-create .dsh-tag-input:focus{box-shadow:none}
.dsh-tag-create:focus-within{border-color:var(--dsh-tag-accent,var(--dsw-alias-border-l3,rgba(127,127,127,.32)))}
.dsh-tag-settings{display:flex;flex-direction:column;gap:14px;width:100%}
.dsh-tag-settingsHead{display:flex;flex-direction:column;gap:4px}
.dsh-tag-settingsTitle{margin:0;font-size:16px;line-height:24px;font-weight:500;color:var(--dsw-alias-label-primary,#111)}
.dsh-tag-switchRow{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:2px 0 14px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.16))}
.dsh-tag-switchText{min-width:0;display:flex;flex-direction:column;gap:2px}
.dsh-tag-switchTitle{font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary,#111)}
.dsh-tag-switchDesc{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-tertiary,#888))}
.dsh-tag-switchRow .dsh-tag-error{margin:2px 0 0}
.dsh-tag-settingsList{display:flex;flex-direction:column;gap:8px;margin-top:2px;padding:0;border-radius:0;background:transparent}
.dsh-tag-rowWrap{box-sizing:border-box;display:flex;flex-direction:column;width:100%;padding:0 14px;border:1px solid var(--dsh-tag-frame,var(--dsw-alias-settings-card-stroke,rgba(127,127,127,.24)));border-radius:12px;background:var(--dsw-alias-settings-card-fill,transparent)}
.dsh-tag-row{display:flex;align-items:center;gap:10px;min-height:44px;padding:2px 0;border-bottom:0}
.dsh-tag-row .dsh-tag-input{flex:1;min-width:0;height:32px;padding:0 8px;border:0;border-radius:6px;background:transparent;outline:none}
.dsh-tag-row .dsh-tag-input:focus{background:transparent;box-shadow:none}
.dsh-tag-rowWrap:focus-within{border-color:var(--dsh-tag-accent,var(--dsw-alias-settings-card-stroke,rgba(127,127,127,.24)))}.dsh-tag-settingsCreate{padding-top:12px}
.dsh-tag-empty{padding:10px 0;font-size:13px;color:var(--dsw-alias-label-tertiary,#888)}
.dsh-tag-hover{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;line-height:17px;color:#cfd3d6}
.dsh-tag-hoverItem{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.dsh-tag-filterWrap{flex:none;box-sizing:border-box;width:100%}
.dsh-tag-filter{display:flex;align-items:center;gap:6px;flex:none;box-sizing:border-box;width:100%;padding:2px var(--dsh-sidebar-row-padding,8px) 6px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
.dsh-tag-filter::-webkit-scrollbar{display:none}
/* The rainbow background is built from COLORS at runtime. */
.dsh-tag-filterAll{position:relative;width:20px;height:20px;padding:0;border:0;border-radius:50%;flex:none;cursor:pointer;opacity:.55;transition:opacity .12s ease}
.dsh-tag-filterAll::after{content:'';position:absolute;inset:4px;border-radius:50%;background:var(--dsw-alias-surface-primary,#fff)}
.dsh-tag-filterAll:hover{opacity:1}
.dsh-tag-filterAll.is-active{opacity:1}
.dsh-tag-filterBlock{position:relative;width:20px;height:20px;padding:0;border:0;border-radius:50%;flex:none;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);transition:opacity .12s ease}
.dsh-tag-filterBlock:hover{opacity:.82}
.dsh-tag-filterBlock.is-active{opacity:1}
.dsh-tag-filterBlock.is-active::after{content:'✓';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;line-height:1;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.dsh-tag-menuLabel{display:flex;align-items:center;justify-content:space-between;gap:20px;width:100%}
.dsh-tag-menuCheck{flex:none;color:var(--dsw-alias-state-business-primary,#3d7bfd);font-weight:600}
.dsh-tag-filterEmpty{box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:clamp(220px,52vh,460px);padding:24px var(--dsh-sidebar-row-padding,8px) 40px;text-align:center}
.dsh-tag-filterEmpty[hidden]{display:none}
.dsh-tag-emptyIcon{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1));color:var(--dsw-alias-label-tertiary,#888)}
.dsh-tag-emptyTitle{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary,#111))}
.dsh-tag-emptyHint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#888)}
.dsh-tag-emptyAction{margin-top:2px;padding:3px 10px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-state-business-primary,#3d7bfd);font:inherit;font-size:12px;line-height:18px;cursor:pointer}
.dsh-tag-emptyAction:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.08))}
`

    function isHex(value) {
      return typeof value === 'string' && HEX_COLOR.test(value)
    }

    /** Palette hex, or a stored custom hex; anything else falls back to gray. */
    function swatch(color) {
      return COLORS[color]?.hex ?? (isHex(color) ? color : COLORS.gray.hex)
    }

    /** Title text: palette token when known, stored hex otherwise. */
    function textColor(color) {
      return COLORS[color]?.text ?? (isHex(color) ? color : COLORS.gray.text)
    }

    /** The "all colors" ring, generated from the same palette as the swatches. */
    function rainbow() {
      const step = 360 / SWATCHES.length
      const stops = SWATCHES.map((name, index) =>
        `${COLORS[name].hex} ${index * step}deg ${(index + 1) * step}deg`)
      return `conic-gradient(${stops.join(',')})`
    }

    /** Hex from the palette, with alpha for the card outline. */
    function tint(hex, alpha) {
      const match = HEX_COLOR.exec(hex)
      if (match === null) return hex
      const value = Number.parseInt(match[0].slice(1), 16)
      const red = (value >> 16) & 0xff
      const green = (value >> 8) & 0xff
      const blue = value & 0xff
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`
    }

    /** Menu dot as an inline SVG so every tag carries its own color. */
    function dotSrc(color) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="${swatch(color)}"/></svg>`
      return `data:image/svg+xml,${encodeURIComponent(svg)}`
    }

    function DotIcon({ icon }) {
      if (!icon || typeof icon.src !== 'string') return null
      return h('img', { src: icon.src, width: 12, height: 12, alt: '', style: { display: 'block' } })
    }

    function Dot({ color, className = 'dsh-tag-dot' }) {
      return h('span', {
        className,
        style: { backgroundColor: swatch(color) },
        'aria-hidden': 'true',
      })
    }

    function TagIcon({ size = 16, active }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true },
        h('path', {
          d: TAG_PATH,
          fill: active ? 'currentColor' : 'none',
          stroke: 'currentColor',
          strokeWidth: 1.2,
        }),
        h('circle', {
          cx: 5.2,
          cy: 5.2,
          r: 1,
          fill: active ? 'var(--dsw-alias-surface-primary,#fff)' : 'currentColor',
        }))
    }

    return {
      inject: ['slots', 'locale', 'contextMenus'],
      apply(ctx) {
        ctx.effect(
          () => ctx.locale.register(NS, { en, zh, ja, es, fr, de, ru, pt }),
          'dsh-tag: copy',
        )
        const t = ctx.locale.bind(NS)

        function addStyle(kind) {
          const style = document.createElement('style')
          style.dataset.dshTag = kind
          document.head.append(style)
          return style
        }
        const baseStyle = addStyle('base')
        baseStyle.textContent = CSS
        const colorStyle = addStyle('color')
        const filterStyle = addStyle('filter')

        // ── Data ───────────────────────────────────────────────────────────────
        let state = {
          settings: { showFilter: true },
          tags: [],
          sessions: {},
          workspaces: [],
          loaded: false,
          error: null,
        }
        const listeners = new Set()
        function emit() {
          for (const listener of [...listeners]) listener()
        }
        function setState(patch) {
          state = { ...state, ...patch }
          emit()
          paint()
        }
        function subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        }
        function getState() {
          return state
        }
        function applySnapshot(data) {
          setState({ ...normalize(data), loaded: true, error: null })
        }

        function tagOf(tagId) {
          return state.tags.find(tag => tag.id === tagId)
        }
        /** Colors still available to a tag, keeping the current one selectable. */
        function colorChoices(tags, exceptId, currentColor) {
          const used = new Set(tags.filter(tag => tag.id !== exceptId).map(tag => tag.color))
          return SWATCHES.filter(name => name === currentColor || !used.has(name))
        }
        /** Localized palette name; unknown colors keep their stored id. */
        function colorName(name) {
          const key = `color${String(name).charAt(0).toUpperCase()}${String(name).slice(1)}`
          const text = t(key)
          return typeof text === 'string' && text.length > 0 && text !== key ? text : name
        }
        function tagColor(tagId) {
          const tag = tagOf(tagId)
          return tag === undefined ? null : textColor(tag.color)
        }
        function paint() {
          const rules = []
          for (const [sessionId, tagId] of Object.entries(state.sessions)) {
            const color = tagColor(tagId)
            if (color !== null) rules.push(rule('session', sessionId, color))
          }
          for (const workspace of state.workspaces) {
            const color = tagColor(workspace.tagId)
            if (color !== null) rules.push(rule('workspace', workspace.id, color))
          }
          colorStyle.textContent = rules.join('\n')
          renderFilter()
          applyFilter()
        }
        function cssSafe(value) {
          return String(value).replace(/["\\\r\n]/g, '')
        }
        function rule(kind, id, color) {
          return `[data-row-key="${kind}:${cssSafe(id)}"] [class*="_title"]{color:${color}}`
        }

        function isRecord(value) {
          return value !== null && typeof value === 'object' && !Array.isArray(value)
        }
        function readTag(value) {
          if (typeof value === 'string') return value
          if (Array.isArray(value)) {
            for (let index = value.length - 1; index >= 0; index -= 1) {
              if (typeof value[index] === 'string') return value[index]
            }
            return undefined
          }
          if (isRecord(value)) {
            if (typeof value.tagId === 'string') return value.tagId
            if (Array.isArray(value.tagIds)) return readTag(value.tagIds)
          }
          return undefined
        }

        /** Older hosts may send partial data; keep the UI able to render it. */
        function normalizeTags(value) {
          if (!Array.isArray(value)) return []
          const tags = []
          for (const item of value) {
            if (!isRecord(item)) continue
            const id = typeof item.id === 'string' ? item.id : ''
            if (id.length === 0) continue
            tags.push({
              id,
              label: typeof item.label === 'string' && item.label.length > 0 ? item.label : id,
              color: typeof item.color === 'string' ? item.color : 'gray',
              order: typeof item.order === 'number' && Number.isFinite(item.order) ? item.order : 0,
            })
          }
          return tags
        }

        function normalize(data) {
          const source = isRecord(data) ? data : {}
          const settings = {
            // An older host has no settings field; keep the bar visible.
            showFilter: !(isRecord(source.settings) && source.settings.showFilter === false),
          }
          const tags = normalizeTags(source.tags)
          const sessions = {}
          if (isRecord(source.sessions)) {
            for (const [id, value] of Object.entries(source.sessions)) {
              const tagId = readTag(value)
              if (tagId !== undefined) sessions[id] = tagId
            }
          }
          const workspaces = (Array.isArray(source.workspaces) ? source.workspaces : [])
            .map(item => {
              const tagId = readTag(item)
              return {
                id: isRecord(item) ? String(item.id || '') : '',
                ...(isRecord(item) && typeof item.path === 'string' ? { path: item.path } : {}),
                tagId,
              }
            })
            .filter(item => item.id.length > 0 && typeof item.tagId === 'string' && item.tagId.length > 0)
          return { settings, tags, sessions, workspaces }
        }

        // ── Filter bar ─────────────────────────────────────────────────────────
        const FILTER_KEY = 'dsh.tag.filter.v1'
        let filterTag = readFilter()
        let filterWrap = null
        let filterBar = null
        let filterEmpty = null
        let emptyTitle = null
        let filterObserver = null
        let filterTimer = 0
        let filterSignature = ''

        /**
         * Live list data from dsh's workspace and session services. The DOM only
         * contains expanded rows, so hiding non-matching rows is not enough to
         * build a real filter: counts, empty groups and auto-expansion need the
         * whole tree. Both services are optional so an older dsh still works.
         */
        let workspaceMembers = null // Map<workspaceId, Set<sessionId>>
        let sessionCatalog = null // Set<sessionId>
        let archivedSessions = new Set()
        /** Workspace row keys this filter opened; closed again when it clears. */
        const autoExpanded = new Set()
        /** Groups whose "show more sessions" button the filter pressed. */
        const autoRevealed = new Set()
        /** Groups the user collapsed while a filter is active; never re-open them. */
        const userCollapsed = new Set()
        let autoClicking = 0

        function readFilter() {
          try {
            const value = window.localStorage.getItem(FILTER_KEY)
            return typeof value === 'string' && value.length > 0 ? value : null
          } catch {
            return null
          }
        }
        function writeFilter() {
          try {
            if (filterTag === null) window.localStorage.removeItem(FILTER_KEY)
            else window.localStorage.setItem(FILTER_KEY, filterTag)
          } catch {
            // Blocked storage only loses persistence; the filter still applies.
          }
        }
        /** Drop the active tag and restore groups this filter opened. */
        function resetFilter() {
          restoreExpanded()
          userCollapsed.clear()
          filterTag = null
          writeFilter()
        }
        function clearFilter() {
          resetFilter()
          renderFilter()
          applyFilter()
        }
        function selectFilter(tagId) {
          if (tagId === filterTag) {
            clearFilter()
            return
          }
          // Groups opened for the previous tag go back to their saved state,
          // except those that also match the new tag and stay open.
          restoreExpanded(expandedKeys(computeGroups(tagId)))
          userCollapsed.clear()
          filterTag = tagId
          writeFilter()
          renderFilter()
          applyFilter()
        }
        /** Simulate a row click without recording it as a user decision. */
        function clickNode(node) {
          if (node === null) return
          autoClicking += 1
          try {
            node.click()
          } finally {
            autoClicking -= 1
          }
        }
        /** Our own writes are not React updates; pausing the observer avoids feedback loops. */
        function withoutObserver(task) {
          if (filterObserver !== null) filterObserver.disconnect()
          try {
            return task()
          } finally {
            if (filterObserver !== null) {
              filterObserver.observe(document.body, { childList: true, subtree: true })
            }
          }
        }
        function ensureWrap() {
          if (filterWrap !== null) return filterWrap
          filterWrap = document.createElement('div')
          filterWrap.className = 'dsh-tag-filterWrap'
          filterBar = document.createElement('div')
          filterBar.className = 'dsh-tag-filter'
          filterBar.setAttribute('role', 'toolbar')
          filterBar.setAttribute('aria-label', t('filterTitle'))
          filterEmpty = document.createElement('div')
          filterEmpty.className = 'dsh-tag-filterEmpty'
          filterEmpty.hidden = true
          const icon = document.createElement('span')
          icon.className = 'dsh-tag-emptyIcon'
          icon.setAttribute('aria-hidden', 'true')
          icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 16 16">' +
            `<path d="${TAG_PATH}" fill="none" stroke="currentColor" stroke-width="1.2"/>` +
            '<circle cx="5.2" cy="5.2" r="1" fill="currentColor"/></svg>'
          emptyTitle = document.createElement('p')
          emptyTitle.className = 'dsh-tag-emptyTitle'
          emptyTitle.setAttribute('aria-live', 'polite')
          const hint = document.createElement('p')
          hint.className = 'dsh-tag-emptyHint'
          hint.textContent = t('emptyHint')
          const action = document.createElement('button')
          action.type = 'button'
          action.className = 'dsh-tag-emptyAction'
          action.textContent = t('clearFilter')
          action.addEventListener('click', clearFilter)
          filterEmpty.append(icon, emptyTitle, hint, action)
          filterWrap.append(filterBar, filterEmpty)
          return filterWrap
        }
        /** Rebuild the colour blocks only when the tag list or the selection changed. */
        function renderFilter() {
          if (!state.settings.showFilter) {
            // A hidden bar must not keep filtering: drop the selection and the
            // CSS rules it generated, otherwise rows stay hidden with no way
            // back to the full list.
            if (filterTag !== null || autoExpanded.size > 0 || autoRevealed.size > 0) {
              resetFilter()
              filterSignature = ''
              filterStyle.textContent = ''
            }
            if (filterWrap !== null) filterWrap.hidden = true
            if (filterEmpty !== null) filterEmpty.hidden = true
            return
          }
          if (filterWrap === null) return
          const tags = state.tags
          filterWrap.hidden = tags.length === 0
          if (tags.length === 0) {
            if (filterSignature !== '') {
              filterSignature = ''
              withoutObserver(() => filterBar.replaceChildren())
            }
            if (filterTag !== null && state.loaded) resetFilter()
            filterEmpty.hidden = true
            return
          }
          if (filterTag !== null && !tags.some(tag => tag.id === filterTag)) {
            resetFilter()
          }
          // The MutationObserver re-mounts the bar after React updates. Rebuilding
          // the buttons on every pass would replace the node between a real
          // pointerdown and click, so the click would be lost.
          const signature = JSON.stringify([filterTag, tags.map(tag => [tag.id, tag.label, tag.color, tag.order])])
          if (signature === filterSignature) return
          filterSignature = signature
          const all = document.createElement('button')
          all.type = 'button'
          all.className = 'dsh-tag-filterAll' + (filterTag === null ? ' is-active' : '')
          all.style.background = rainbow()
          all.title = t('filterAll')
          all.setAttribute('aria-label', t('filterAll'))
          all.setAttribute('aria-pressed', String(filterTag === null))
          all.addEventListener('click', clearFilter)
          const blocks = tags.map(tag => {
            const block = document.createElement('button')
            block.type = 'button'
            block.className = 'dsh-tag-filterBlock' + (filterTag === tag.id ? ' is-active' : '')
            block.style.backgroundColor = swatch(tag.color)
            block.title = tag.label
            block.setAttribute('aria-label', tag.label)
            block.setAttribute('aria-pressed', String(filterTag === tag.id))
            block.addEventListener('click', () => selectFilter(tag.id))
            return block
          })
          withoutObserver(() => filterBar.replaceChildren(all, ...blocks))
        }
        /** The session list's scroll container and the node to insert the bar before. */
        function filterAnchor() {
          // Workspace rows are also present when every group is collapsed, so the
          // bar can be mounted even before a single session row is rendered.
          const rows = document.querySelectorAll('[data-row-key^="session:"], [data-row-key^="workspace:"], [data-row-key="empty"]')
          if (rows.length === 0) return null
          let node = rows[0]
          while (node !== null && node !== document.body) {
            const overflow = getComputedStyle(node).overflowY
            if (overflow === 'auto' || overflow === 'scroll') {
              const parent = node.parentElement
              if (parent === null) return null
              return { parent, before: node }
            }
            node = node.parentElement
          }
          return null
        }
        function mountFilter() {
          const place = filterAnchor()
          if (place === null) return false
          const wrap = ensureWrap()
          if (wrap.parentElement !== place.parent) {
            withoutObserver(() => place.parent.insertBefore(wrap, place.before))
          }
          renderFilter()
          return true
        }

        /**
         * Every existing session carrying the tag, as far as dsh's own list is
         * concerned. Derived data is unavailable on older builds, and then the
         * filter falls back to the rows currently in the DOM.
         */
        function computeGroups(tagId) {
          if (workspaceMembers === null || sessionCatalog === null) return null
          const live = (sessionId) => sessionCatalog.has(sessionId) && !archivedSessions.has(sessionId)
          const tagged = new Set()
          for (const [sessionId, owner] of Object.entries(state.sessions)) {
            if (owner !== tagId) continue
            if (!live(sessionId)) continue
            tagged.add(sessionId)
          }
          // A workspace tag covers its whole group: the workspace is a tagged
          // entity, so its sessions share the result. Session tags stay local.
          const taggedWorkspaces = new Set()
          for (const workspace of state.workspaces) {
            if (workspace.tagId === tagId) taggedWorkspaces.add(workspace.id)
          }
          const matched = new Set(tagged)
          for (const workspaceId of taggedWorkspaces) {
            const ids = workspaceMembers.get(workspaceId)
            if (ids === undefined) continue
            for (const id of ids) {
              if (live(id)) matched.add(id)
            }
          }
          const byWorkspace = new Map()
          const ownSessions = new Map()
          const grouped = new Set()
          for (const [workspaceId, ids] of workspaceMembers) {
            const hits = new Set()
            const own = new Set()
            for (const id of ids) {
              grouped.add(id)
              if (matched.has(id)) hits.add(id)
              if (tagged.has(id)) own.add(id)
            }
            ownSessions.set(workspaceId, own)
            byWorkspace.set(workspaceId, hits.size)
          }
          const ungroupedIds = new Set()
          for (const id of matched) {
            if (!grouped.has(id)) ungroupedIds.add(id)
          }
          return {
            tagged,
            taggedWorkspaces,
            matched,
            byWorkspace,
            ownSessions,
            ungroupedIds,
            ungrouped: ungroupedIds.size,
            total: matched.size,
          }
        }

        function renderedIds() {
          const ids = new Set()
          for (const row of document.querySelectorAll('[data-row-key^="session:"]')) {
            ids.add((row.getAttribute('data-row-key') || '').slice('session:'.length))
          }
          return ids
        }

        function renderedMatches(tagId) {
          const ids = renderedIds()
          let count = 0
          for (const id of ids) {
            if (state.sessions[id] === tagId) count += 1
          }
          return count
        }

        /** Row keys of the groups that hold at least one match. */
        function expandedKeys(groups) {
          const keys = new Set()
          if (groups === null) return keys
          for (const [workspaceId, count] of groups.byWorkspace) {
            if (count > 0) keys.add(`workspace:${workspaceId}`)
          }
          if (groups.ungrouped > 0) keys.add('workspace:')
          return keys
        }

        /**
         * Open the groups that hold matches so the filter reads like a result
         * list instead of a tree the user has to unfold. Only groups this filter
         * opened are recorded, and clearing it closes exactly those again.
         */
        function expandMatches(groups) {
          for (const key of expandedKeys(groups)) {
            if (autoExpanded.has(key) || userCollapsed.has(key)) continue
            const row = document.querySelector(`[data-row-key="${cssSafe(key)}"]`)
            if (row === null || row.getAttribute('aria-expanded') !== 'false') continue
            // The group header's own onClick toggles and persists expansion.
            clickNode(row)
            autoExpanded.add(key)
          }
        }
        function restoreExpanded(keep) {
          if (autoRevealed.size !== 0) {
            for (const key of [...autoRevealed]) {
              if (keep !== undefined && keep.has(key)) continue
              autoRevealed.delete(key)
              const group = key.slice('workspace:'.length)
              const button = document.querySelector(`[data-row-key="overflow:${cssSafe(group)}"]`)
              if (button === null || button.getAttribute('aria-expanded') !== 'true') continue
              clickNode(button)
            }
          }
          if (autoExpanded.size === 0) return
          const keys = [...autoExpanded]
          autoExpanded.clear()
          for (const key of keys) {
            if (keep !== undefined && keep.has(key)) {
              // Still relevant to the next filter: leave it open and owned.
              autoExpanded.add(key)
              continue
            }
            const row = document.querySelector(`[data-row-key="${cssSafe(key)}"]`)
            if (row === null || row.getAttribute('aria-expanded') !== 'true') continue
            clickNode(row)
          }
        }

        /**
         * A group shows five sessions plus a "show more" row. When a match sits
         * beyond that watermark, press the row until the match is rendered so
         * the filter never points at a session the user cannot see.
         */
        function revealMatches(groups) {
          const unresolved = new Set()
          if (groups === null) return unresolved
          for (const key of expandedKeys(groups)) {
            if (userCollapsed.has(key)) continue
            const workspaceId = key.slice('workspace:'.length)
            const hits = workspaceId === '' ? groups.ungroupedIds : groups.ownSessions.get(workspaceId)
            if (hits === undefined || hits.size === 0) continue
            const missingFrom = (rendered) => {
              for (const id of hits) {
                if (!rendered.has(id)) return true
              }
              return false
            }
            if (!missingFrom(renderedIds())) continue
            for (let step = 0; step < 40; step += 1) {
              const button = document.querySelector(`[data-row-key="overflow:${cssSafe(workspaceId)}"]`)
              if (button === null || button.getAttribute('aria-expanded') === 'true') break
              clickNode(button)
              autoRevealed.add(key)
              if (!missingFrom(renderedIds())) break
            }
            // If the list still does not contain a match (stale catalog, very
            // large group), keep its show-more control visible so the data is
            // reachable instead of silently filtering it out.
            if (missingFrom(renderedIds())) unresolved.add(key)
          }
          return unresolved
        }

        function renderEmpty(activeTag, groups) {
          if (filterEmpty === null) return
          let text = null
          if (groups === null) {
            if (renderedMatches(activeTag.id) === 0) text = t('filterEmpty', { label: activeTag.label })
          } else if (groups.total === 0) {
            if (groups.taggedWorkspaces.size > 0) text = t('workspaceEmpty', { label: activeTag.label })
            else if (renderedMatches(activeTag.id) === 0) text = t('filterEmpty', { label: activeTag.label })
          }
          if (text !== null) {
            if (emptyTitle !== null && emptyTitle.textContent !== text) emptyTitle.textContent = text
            if (filterEmpty.hidden) filterEmpty.hidden = false
          } else if (!filterEmpty.hidden) {
            filterEmpty.hidden = true
          }
        }

        /**
         * Filtering is pure CSS: one rule hides every session row, later rules
         * re-show the matching ids. Groups without matches lose their header, so
         * an active filter never leaves a column of empty sections behind.
         */
        function applyFilter() {
          const activeTag = filterTag === null ? undefined : tagOf(filterTag)
          if (activeTag === undefined) {
            if (filterStyle.textContent !== '') filterStyle.textContent = ''
            if (filterEmpty !== null) filterEmpty.hidden = true
            return
          }
          const groups = computeGroups(activeTag.id)
          expandMatches(groups)
          const unresolvedOverflow = revealMatches(groups)
          const rules = ['[data-row-key^="session:"]{display:none!important}']
          // With derived data we can prove every match is rendered before
          // hiding the show-more controls. Without it, keep the old behaviour:
          // only the expanded "collapse" control is hidden, so a tagged row can
          // still be reached by expanding the group manually.
          if (groups === null) {
            rules.push('[data-row-key^="overflow:"][aria-expanded="true"]{display:none!important}')
          } else {
            rules.push('[data-row-key^="overflow:"]{display:none!important}')
          }
          const show = new Set()
          for (const [sessionId, owner] of Object.entries(state.sessions)) {
            if (owner === activeTag.id) show.add(sessionId)
          }
          if (groups !== null) {
            for (const sessionId of groups.matched) show.add(sessionId)
          }
          for (const sessionId of show) {
            rules.push(`[data-row-key="session:${cssSafe(sessionId)}"]{display:flex!important}`)
          }
          if (groups !== null) {
            const hideGroup = (key) => {
              rules.push(`[data-row-key="${cssSafe(key)}"]{display:none!important}`)
              rules.push(`span:has(> [data-row-key="${cssSafe(key)}"]){display:none!important}`)
              rules.push(`[data-row-key="overflow:${cssSafe(key.slice('workspace:'.length))}"]{display:none!important}`)
            }
            const badge = (key, count) => {
              rules.push(
                `[data-row-key="${cssSafe(key)}"] [class*="_title"]::after{content:"${count}";` +
                'margin-left:6px;padding:0 5px;border-radius:7px;display:inline-block;' +
                'background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.16));' +
                'color:var(--dsw-alias-label-tertiary,#888);font-size:11px;line-height:15px;font-weight:400}',
              )
            }
            for (const [workspaceId, count] of groups.byWorkspace) {
              const key = `workspace:${workspaceId}`
              if (count > 0) badge(key, count)
              // A tagged workspace belongs to the result even when it holds no
              // session; its coloured title is the only marker it needs.
              else if (!groups.taggedWorkspaces.has(workspaceId)) hideGroup(key)
            }
            if (groups.ungrouped === 0) hideGroup('workspace:')
            else badge('workspace:', groups.ungrouped)
            for (const key of unresolvedOverflow) {
              const workspaceId = key.slice('workspace:'.length)
              rules.push(`[data-row-key="overflow:${cssSafe(workspaceId)}"]{display:flex!important}`)
            }
          }
          filterStyle.textContent = rules.join('\n')
          renderEmpty(activeTag, groups)
        }
        /** Collapse one burst of React mutations into one mount + filter pass. */
        function scheduleFilter() {
          if (filterTimer !== 0) return
          filterTimer = window.setTimeout(() => {
            filterTimer = 0
            mountFilter()
            applyFilter()
          }, 50)
        }

        async function refresh() {
          try {
            const response = await fetch(API, { cache: 'no-store', credentials: 'same-origin' })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            applySnapshot(await response.json())
          } catch (error) {
            setState({ loaded: true, error: error instanceof Error ? error.message : String(error) })
          }
        }

        let source
        let retryTimer
        let disposed = false
        function connect() {
          if (disposed || source !== undefined || typeof EventSource !== 'function') return
          try {
            source = new EventSource(EVENTS)
            source.onmessage = (event) => {
              try {
                applySnapshot(JSON.parse(event.data))
              } catch {
                // A malformed frame is ignored; the next snapshot replaces it.
              }
            }
            source.onerror = () => {
              if (source !== undefined) {
                source.close()
                source = undefined
              }
              if (retryTimer !== undefined || disposed) return
              retryTimer = window.setTimeout(() => {
                retryTimer = undefined
                connect()
              }, 5000)
            }
          } catch {
            source = undefined
          }
        }

        async function request(method, path, body) {
          const response = await fetch(API + path, {
            method,
            credentials: 'same-origin',
            headers: body === undefined ? undefined : { 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
          })
          const text = await response.text()
          let data = null
          try {
            data = text.length > 0 ? JSON.parse(text) : null
          } catch {
            // Non-JSON error body; the status is enough.
          }
          if (!response.ok) {
            const message = data && data.error ? (data.error.message || data.error.code) : `HTTP ${response.status}`
            throw new Error(message)
          }
          if (data && data.snapshot) applySnapshot(data.snapshot)
          return data
        }

        function setTag(kind, target, tagId) {
          const base = kind === 'session' ? 'sessions' : 'workspaces'
          const body = kind === 'workspace' && typeof target.path === 'string'
            ? { tagId, path: target.path }
            : { tagId }
          return request('PUT', `/${base}/${encodeURIComponent(target.id)}`, body)
        }

        /**
         * One submenu for the captured row. `resolve` runs when the menu opens,
         * so the checked state matches the latest snapshot.
         */
        function tagMenu(kind, target) {
          const current = kind === 'session'
            ? state.sessions[target.id]
            : state.workspaces.find(item => item.id === target.id)?.tagId
          const parentLabel = kind === 'session' ? t('menuSession') : t('menuWorkspace')
          if (state.tags.length === 0) {
            return [{ id: 'tags', label: parentLabel, disabled: true, children: [{ id: 'empty', label: t('noTags'), disabled: true }] }]
          }
          const children = state.tags.map(tag => {
            const active = current === tag.id
            return {
              id: `tag:${tag.id}`,
              label: active
                ? h('span', { className: 'dsh-tag-menuLabel' },
                  h('span', null, tag.label),
                  h('span', { className: 'dsh-tag-menuCheck', 'aria-hidden': 'true' }, '✓'))
                : tag.label,
              icon: { key: 'dsh-tag.dot', src: dotSrc(tag.color) },
              failureLabel: t('failed'),
              run: () => setTag(kind, target, active ? null : tag.id),
            }
          })
          if (typeof current === 'string' && current.length > 0) {
            children.push({
              id: 'clear',
              label: t('clear'),
              separatorBefore: true,
              failureLabel: t('failed'),
              run: () => setTag(kind, target, null),
            })
          }
          return [{
            id: 'tags',
            label: parentLabel,
            icon: { key: 'dsh-tag.icon' },
            children,
          }]
        }

        // ── Settings ───────────────────────────────────────────────────────────
        /** Shared busy/error state for the settings page's async mutations. */
        function useTask() {
          const [busy, setBusy] = React.useState(false)
          const [error, setError] = React.useState(null)
          const run = React.useCallback(async (task) => {
            setBusy(true)
            setError(null)
            try {
              return await task()
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : String(failure))
              return undefined
            } finally {
              setBusy(false)
            }
          }, [])
          return { busy, error, run }
        }

        /**
         * Color trigger: the dot opens a small listbox of the colors still
         * available to this row. Used colors never reach the menu.
         */
        function ColorPicker({ value, options, disabled = false, align = 'left', onChange, label }) {
          const [open, setOpen] = React.useState(false)
          const wrapRef = React.useRef(null)

          React.useEffect(() => {
            if (!open) return undefined
            const onDown = (event) => {
              if (wrapRef.current !== null && !wrapRef.current.contains(event.target)) setOpen(false)
            }
            document.addEventListener('mousedown', onDown)
            return () => document.removeEventListener('mousedown', onDown)
          }, [open])

          return h('div', { className: 'dsh-tag-dotWrap', ref: wrapRef },
            h('button', {
              type: 'button',
              className: 'dsh-tag-pickerButton',
              disabled,
              'aria-label': label,
              title: label,
              'aria-haspopup': 'listbox',
              'aria-expanded': open,
              onClick: () => setOpen(current => !current),
            },
            h(Dot, { color: value })),
            open && options.length > 0
              ? h('div', {
                className: 'dsh-tag-colorMenu' + (align === 'right' ? ' is-right' : ''),
                role: 'listbox',
              }, options.map(name => h('button', {
                key: name,
                type: 'button',
                className: 'dsh-tag-swatch' + (value === name ? ' is-current' : ''),
                style: { backgroundColor: swatch(name) },
                'aria-label': colorName(name),
                title: colorName(name),
                onClick: () => {
                  setOpen(false)
                  onChange(name)
                },
              })))
              : null)
        }

        function TagRow({ tag, tags }) {
          const [text, setText] = React.useState(tag.label)
          const { busy, error, run } = useTask()
          const colorOptions = colorChoices(tags, tag.id, tag.color)

          React.useEffect(() => {
            setText(tag.label)
          }, [tag.label])

          const save = () => {
            const next = text.trim()
            if (next.length === 0 || next === tag.label) return
            void run(() => request('PATCH', `/${encodeURIComponent(tag.id)}`, { label: next }))
          }
          const recolor = (color) => {
            void run(() => request('PATCH', `/${encodeURIComponent(tag.id)}`, { color }))
          }
          const remove = () => {
            if (!window.confirm(t('confirmDelete', { label: tag.label }))) return
            void run(() => request('DELETE', `/${encodeURIComponent(tag.id)}`))
          }

          return h('div', {
            className: 'dsh-tag-rowWrap',
            style: {
              '--dsh-tag-accent': swatch(tag.color),
              '--dsh-tag-frame': tint(swatch(tag.color), 0.35),
            },
          },
            h('div', { className: 'dsh-tag-row' },
              h(ColorPicker, {
                value: tag.color,
                options: colorOptions,
                disabled: busy,
                onChange: recolor,
                label: t('cycleColor'),
              }),
              h('input', {
                className: 'dsh-tag-input',
                value: text,
                maxLength: 48,
                disabled: busy,
                style: { color: textColor(tag.color) },
                'aria-label': tag.label,
                onChange: (event) => setText(event.target.value),
                onBlur: save,
                onKeyDown: (event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  event.currentTarget.blur()
                },
              }),
              h('button', {
                type: 'button',
                className: 'dsh-tag-delete',
                disabled: busy,
                'aria-label': t('remove'),
                title: t('remove'),
                onClick: remove,
              }, h('svg', {
                width: 15,
                height: 15,
                viewBox: '0 0 16 16',
                'aria-hidden': true,
              }, h('path', {
                d: 'M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5M6.5 7v4M9.5 7v4',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.2,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              })))),
            error === null ? null : h('p', { className: 'dsh-tag-error' }, error))
        }

        function SettingsPage() {
          const snapshot = React.useSyncExternalStore(subscribe, getState)
          const [label, setLabel] = React.useState('')
          const [color, setColor] = React.useState('green')
          const createTask = useTask()
          const filterTask = useTask()
          const availableColors = colorChoices(snapshot.tags, null, null)
          const atLimit = snapshot.tags.length >= MAX_TAGS
          const selectedColor = availableColors.includes(color) ? color : availableColors[0] ?? ''
          const settingsBusy = filterTask.busy
          const settingsError = filterTask.error !== null

          React.useEffect(() => {
            void refresh()
          }, [])

          React.useEffect(() => {
            if (!availableColors.includes(color)) setColor(availableColors[0] ?? '')
          }, [snapshot.tags, color])

          const toggleFilter = (next) => {
            void filterTask.run(() => request('PATCH', '/settings', { showFilter: next }))
          }

          const create = () => {
            const text = label.trim()
            if (text.length === 0 || atLimit || selectedColor.length === 0) return
            void createTask.run(async () => {
              await request('POST', '', { label: text, color: selectedColor })
              setLabel('')
            })
          }

          return h('section', { className: 'dsh-tag-settings' },
            h('header', { className: 'dsh-tag-settingsHead' },
              h('h2', { className: 'dsh-tag-settingsTitle' }, TITLE)),
            h('div', { className: 'dsh-tag-switchRow' },
              h('div', { className: 'dsh-tag-switchText' },
                h('div', { className: 'dsh-tag-switchTitle' }, t('showFilter')),
                h('div', { className: 'dsh-tag-switchDesc' }, t('filterDesc')),
                settingsError
                  ? h('div', { className: 'dsh-tag-error', role: 'alert' }, t('filterFailed'))
                  : null),
              h(Switch, {
                checked: snapshot.settings.showFilter,
                disabled: settingsBusy,
                label: t('showFilter'),
                onChange: toggleFilter,
              })),
            createTask.error === null ? null : h('p', { className: 'dsh-tag-error' }, createTask.error),
            snapshot.error === null ? null : h('p', { className: 'dsh-tag-error' }, snapshot.error),
            snapshot.tags.length === 0
              ? h('div', { className: 'dsh-tag-empty' }, t('empty'))
              : h('div', { className: 'dsh-tag-settingsList' },
                snapshot.tags.map(tag => h(TagRow, { key: tag.id, tag, tags: snapshot.tags }))),
            atLimit ? null : h('div', {
              className: 'dsh-tag-create dsh-tag-settingsCreate',
              style: selectedColor.length > 0
                ? {
                  '--dsh-tag-accent': swatch(selectedColor),
                  '--dsh-tag-frame': tint(swatch(selectedColor), 0.35),
                }
                : undefined,
            },
              h(ColorPicker, {
                value: selectedColor,
                options: availableColors,
                disabled: createTask.busy || atLimit,
                align: 'left',
                onChange: setColor,
                label: t('color'),
              }),
              h('input', {
                className: 'dsh-tag-input',
                value: label,
                maxLength: 48,
                disabled: createTask.busy || atLimit,
                style: label.trim().length > 0 ? { color: textColor(selectedColor) } : undefined,
                placeholder: atLimit ? t('limit') : t('newPlaceholder'),
                'aria-label': t('newPlaceholder'),
                onChange: (event) => setLabel(event.target.value),
                onKeyDown: (event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  create()
                },
              }),
              h('button', {
                type: 'button',
                className: 'dsh-tag-primary',
                disabled: createTask.busy || atLimit || selectedColor.length === 0 || label.trim().length === 0,
                onClick: create,
              }, t('add'))),
            atLimit
              ? h('p', { className: 'dsh-tag-hint' }, t('limit'))
              : availableColors.length === 0
                ? h('p', { className: 'dsh-tag-hint' }, t('noColors'))
                : null)
        }

        function HoverTag({ sessionId }) {
          const snapshot = React.useSyncExternalStore(subscribe, getState)
          const tagId = snapshot.sessions[sessionId]
          const tag = snapshot.tags.find(item => item.id === tagId)
          if (tag === undefined) return null
          return h('div', { className: 'dsh-tag-hover' }, h('span', {
            className: 'dsh-tag-hoverItem',
          },
          h(Dot, { color: tag.color }),
          tag.label))
        }

        // ── Wiring ─────────────────────────────────────────────────────────────
        /**
         * Membership of every session, not only the rendered rows. Optional:
         * when either service is missing the filter keeps its DOM-only behaviour.
         */
        ctx.inject(['workspaces', 'sessions'], (scope) => {
          let signature = ''
          const sync = () => {
            try {
              const ws = scope.workspaces.list.getSnapshot()
              const list = scope.sessions.list.getSnapshot()
              if (!Array.isArray(ws.items) || !Array.isArray(list.ids)) return
              if (ws.phase !== 'ready' || list.phase !== 'ready') return
              const items = ws.items
              const ids = list.ids
              const next = items.map(item => [String(item.workspaceId), (item.sessionIds || []).map(String)])
              const archived = (ws.archivedSessionIds || []).map(String)
              const nextSignature = JSON.stringify([next, archived, ids])
              if (nextSignature === signature) return
              signature = nextSignature
              workspaceMembers = new Map(next.map(([id, members]) => [id, new Set(members)]))
              archivedSessions = new Set(archived)
              sessionCatalog = new Set(ids.map(String))
              scheduleFilter()
            } catch {
              // A build without these snapshots keeps the DOM-only fallback.
            }
          }
          sync()
          scope.effect(() => {
            const offWorkspaces = scope.workspaces.list.subscribe(sync)
            const offSessions = scope.sessions.list.subscribe(sync)
            return () => {
              offWorkspaces()
              offSessions()
            }
          }, 'dsh-tag: workspace membership')
        })

        ctx.effect(() => {
          filterObserver = new MutationObserver(scheduleFilter)
          filterObserver.observe(document.body, { childList: true, subtree: true })
          scheduleFilter()
          // A manual toggle of a group we opened is respected; clearing the
          // filter must not undo a choice the user just made.
          const rowClick = (event) => {
            if (autoClicking > 0) return
            const target = event.target
            if (!(target instanceof Element)) return
            const overflow = target.closest('[data-row-key^="overflow:"]')
            if (overflow !== null) {
              const key = `workspace:${overflow.getAttribute('data-row-key').slice('overflow:'.length)}`
              if (overflow.getAttribute('aria-expanded') === 'true') {
                // "Collapse sessions": keep the filter from pressing it again.
                userCollapsed.add(key)
                autoRevealed.delete(key)
              } else {
                userCollapsed.delete(key)
              }
              return
            }
            if (target.closest('button') !== null) return
            const row = target.closest('[data-row-key^="workspace:"]')
            if (row === null) return
            const key = row.getAttribute('data-row-key')
            autoExpanded.delete(key)
            autoRevealed.delete(key)
            // Collapsing a group under an active filter is a user decision;
            // expanding it again cancels that decision.
            if (row.getAttribute('aria-expanded') === 'true') userCollapsed.add(key)
            else userCollapsed.delete(key)
          }
          document.addEventListener('click', rowClick, true)
          const onVisibility = () => {
            if (document.hidden) {
              if (retryTimer !== undefined) {
                window.clearTimeout(retryTimer)
                retryTimer = undefined
              }
              if (source !== undefined) {
                source.close()
                source = undefined
              }
              return
            }
            void refresh()
            connect()
          }
          document.addEventListener('visibilitychange', onVisibility)
          void refresh()
          if (!document.hidden) connect()
          return () => {
            disposed = true
            document.removeEventListener('visibilitychange', onVisibility)
            document.removeEventListener('click', rowClick, true)
            if (filterObserver !== null) {
              filterObserver.disconnect()
              filterObserver = null
            }
            if (filterTimer !== 0) {
              window.clearTimeout(filterTimer)
              filterTimer = 0
            }
            if (filterWrap !== null) {
              filterWrap.remove()
              filterWrap = null
              filterBar = null
              filterEmpty = null
              emptyTitle = null
            }
            filterStyle.textContent = ''
            if (source !== undefined) {
              source.close()
              source = undefined
            }
            if (retryTimer !== undefined) {
              window.clearTimeout(retryTimer)
              retryTimer = undefined
            }
          }
        }, 'dsh-tag: data')

        ctx.effect(() => ctx.contextMenus.register({
          id: 'dsh-tag.session',
          target: 'session',
          order: 500,
          resolve: ({ sessionId }) => tagMenu('session', { id: sessionId }),
        }), 'dsh-tag: session menu')

        ctx.effect(() => ctx.contextMenus.register({
          id: 'dsh-tag.workspace',
          target: 'workspace',
          order: 500,
          resolve: ({ workspaceId, path }) => tagMenu('workspace', { id: workspaceId, path }),
        }), 'dsh-tag: workspace menu')

        ctx.slots.inject('contextMenu.icon', () => ctx.slots.register({
          name: 'contextMenu.icon',
          key: 'dsh-tag.dot',
        }, DotIcon))

        ctx.slots.inject('contextMenu.icon', () => ctx.slots.register({
          name: 'contextMenu.icon',
          key: 'dsh-tag.icon',
        }, TagIcon))

        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'dsh-tag',
          order: 6,
          label: () => TITLE,
        }, SettingsPage))

        ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
          name: 'settings.section.icon',
          id: 'dsh-tag',
        }, TagIcon))

        ctx.slots.inject('sidebar.session.row.hover', () => ctx.slots.register({
          name: 'sidebar.session.row.hover',
          id: 'dsh-tag',
          order: 10,
        }, HoverTag))

        ctx.effect(() => () => {
          baseStyle.remove()
          colorStyle.remove()
          filterStyle.remove()
        }, 'dsh-tag: styles')
      },
    }
  },
})
