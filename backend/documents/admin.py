from django.contrib import admin
from .models import Document, AccessRight, DocumentHistory
from mptt.admin import MPTTModelAdmin, DraggableMPTTAdmin

class AccessRightInline(admin.TabularInline):
    model = AccessRight
    extra = 1

class DocumentHistoryInline(admin.TabularInline):
    model = DocumentHistory
    extra = 0
    readonly_fields = ['user', 'changes', 'created_at']
    max_num = 5
    
class DocumentAdmin(DraggableMPTTAdmin):
    list_display = ['tree_actions', 'indented_title', 'id', 'owner', 'created_at', 'updated_at', 'is_favorite', 'is_root']
    list_display_links = ['indented_title']  # Делаем indented_title кликабельным для перехода к редактированию
    list_filter = ['is_favorite', 'is_root', 'created_at', 'updated_at']
    search_fields = ['title', 'owner__username', 'owner__email']
    raw_id_fields = ['owner', 'parent']
    date_hierarchy = 'created_at'
    inlines = [AccessRightInline, DocumentHistoryInline]
    
    # Дополнительные свойства для DraggableMPTTAdmin
    mptt_indent_field = "title"
    
    def indented_title(self, instance):
        """Возвращает заголовок с отступом для отображения в админке"""
        return instance.title
    indented_title.short_description = 'Title'

class AccessRightAdmin(admin.ModelAdmin):
    list_display = ['id', 'document', 'user', 'role', 'include_children', 'created_at']
    list_filter = ['role', 'include_children', 'created_at']
    search_fields = ['document__title', 'user__username', 'user__email']
    raw_id_fields = ['document', 'user']

class DocumentHistoryAdmin(admin.ModelAdmin):
    list_display = ['id', 'document', 'user', 'created_at']
    list_filter = ['created_at']
    search_fields = ['document__title', 'user__username', 'user__email']
    raw_id_fields = ['document', 'user']

# Регистрируем модели для админки
admin.site.register(Document, DocumentAdmin)
admin.site.register(AccessRight, AccessRightAdmin)
admin.site.register(DocumentHistory, DocumentHistoryAdmin)
