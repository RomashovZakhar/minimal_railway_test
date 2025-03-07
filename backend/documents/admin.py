from django.contrib import admin
from mptt.admin import MPTTModelAdmin
from .models import Document, AccessRight, DocumentHistory

class AccessRightInline(admin.TabularInline):
    model = AccessRight
    extra = 1

class DocumentHistoryInline(admin.TabularInline):
    model = DocumentHistory
    extra = 0
    readonly_fields = ['user', 'changes', 'created_at']
    max_num = 5
    
@admin.register(Document)
class DocumentAdmin(MPTTModelAdmin):
    list_display = ['title', 'owner', 'created_at', 'updated_at', 'is_favorite']
    list_filter = ['is_favorite', 'created_at', 'updated_at']
    search_fields = ['title', 'content']
    inlines = [AccessRightInline, DocumentHistoryInline]

@admin.register(AccessRight)
class AccessRightAdmin(admin.ModelAdmin):
    list_display = ['document', 'user', 'role', 'include_children', 'created_at']
    list_filter = ['role', 'include_children', 'created_at']
    search_fields = ['document__title', 'user__email']

@admin.register(DocumentHistory)
class DocumentHistoryAdmin(admin.ModelAdmin):
    list_display = ['document', 'user', 'created_at']
    list_filter = ['created_at']
    search_fields = ['document__title', 'user__email']
    readonly_fields = ['document', 'user', 'changes', 'created_at']
