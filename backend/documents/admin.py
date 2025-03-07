from django.contrib import admin
from .models import Document, AccessRight, DocumentHistory
from mptt.admin import MPTTModelAdmin

class AccessRightInline(admin.TabularInline):
    model = AccessRight
    extra = 1

class DocumentHistoryInline(admin.TabularInline):
    model = DocumentHistory
    extra = 0
    readonly_fields = ['user', 'changes', 'created_at']
    max_num = 5
    
class DocumentAdmin(MPTTModelAdmin):
    list_display = ['id', 'title', 'owner', 'parent', 'created_at', 'updated_at', 'is_favorite']
    list_filter = ['is_favorite', 'created_at', 'updated_at']
    search_fields = ['title', 'owner__username', 'owner__email']
    raw_id_fields = ['owner', 'parent']
    date_hierarchy = 'created_at'
    inlines = [AccessRightInline, DocumentHistoryInline]

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
