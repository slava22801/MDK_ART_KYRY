from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_admin
from app.models.user import User
from app.schemas.menu import (
    MenuCategoryCreate,
    MenuCategoryRead,
    MenuCategoryUpdate,
    MenuCategoryWithItems,
    MenuImageUploadRead,
    MenuItemCreate,
    MenuItemRead,
    MenuItemUpdate,
)
from app.services import menu as menu_service
from app.services.s3 import get_s3

router = APIRouter()


def _attach_image_urls(items: list) -> list[MenuItemRead]:
    s3 = get_s3()
    out: list[MenuItemRead] = []
    for it in items:
        schema = MenuItemRead.model_validate(it)
        if it.image_key:
            schema.image_url = s3.public_url(it.image_key)
        out.append(schema)
    return out


@router.get("", response_model=list[MenuCategoryWithItems])
async def list_menu(session: AsyncSession = Depends(get_session)) -> list[MenuCategoryWithItems]:
    categories = await menu_service.list_categories_with_items(session)
    result: list[MenuCategoryWithItems] = []
    for cat in categories:
        items = _attach_image_urls(list(cat.items))
        result.append(MenuCategoryWithItems(
            id=cat.id,
            name=cat.name,
            description=cat.description,
            sort_order=cat.sort_order,
            items=items,
        ))
    return result


@router.post(
    "/admin/menu/categories",
    response_model=MenuCategoryRead,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create_category(
    payload: MenuCategoryCreate,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
) -> MenuCategoryRead:
    cat = await menu_service.create_category(session, payload)
    return MenuCategoryRead.model_validate(cat)


@router.patch("/admin/menu/categories/{category_id}", response_model=MenuCategoryRead)
async def admin_update_category(
    category_id: int,
    payload: MenuCategoryUpdate,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
) -> MenuCategoryRead:
    cat = await menu_service.get_category(session, category_id)
    if cat is None:
        raise HTTPException(status_code=404, detail="category not found")
    updated = await menu_service.update_category(session, cat, payload)
    return MenuCategoryRead.model_validate(updated)


@router.delete("/admin/menu/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_category(
    category_id: int,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
) -> None:
    cat = await menu_service.get_category(session, category_id)
    if cat is None:
        raise HTTPException(status_code=404, detail="category not found")
    try:
        await menu_service.delete_category(session, cat)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail="category has items; delete them first",
        ) from exc


@router.post(
    "/admin/menu/items",
    response_model=MenuItemRead,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create_item(
    payload: MenuItemCreate,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
) -> MenuItemRead:
    cat = await menu_service.get_category(session, payload.category_id)
    if cat is None:
        raise HTTPException(status_code=400, detail="category not found")
    item = await menu_service.create_item(session, payload)
    out = MenuItemRead.model_validate(item)
    if item.image_key:
        out.image_url = get_s3().public_url(item.image_key)
    return out


@router.patch("/admin/menu/items/{item_id}", response_model=MenuItemRead)
async def admin_update_item(
    item_id: int,
    payload: MenuItemUpdate,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
) -> MenuItemRead:
    item = await menu_service.get_item(session, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="item not found")
    if payload.category_id is not None:
        cat = await menu_service.get_category(session, payload.category_id)
        if cat is None:
            raise HTTPException(status_code=400, detail="category not found")
    updated = await menu_service.update_item(session, item, payload)
    out = MenuItemRead.model_validate(updated)
    if updated.image_key:
        out.image_url = get_s3().public_url(updated.image_key)
    return out


@router.delete("/admin/menu/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_item(
    item_id: int,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
) -> None:
    item = await menu_service.get_item(session, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="item not found")
    await menu_service.delete_item(session, item)


@router.post(
    "/admin/menu/upload-image",
    response_model=MenuImageUploadRead,
    status_code=status.HTTP_201_CREATED,
)
async def admin_upload_menu_image(
    file: Annotated[UploadFile, File(...)],
    _: User = Depends(require_admin),
) -> MenuImageUploadRead:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="file must be an image")
    ext = (file.filename or "image").rsplit(".", 1)[-1].lower()[:8] if "." in (file.filename or "") else "jpg"
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="file too large (max 10 MB)")

    s3 = get_s3()
    key = s3.upload_image(content, file.content_type, ext=ext)
    return MenuImageUploadRead(image_key=key, image_url=s3.public_url(key))