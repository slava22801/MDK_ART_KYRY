from pydantic import BaseModel, ConfigDict, Field


class MenuCategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    sort_order: int = 0


class MenuCategoryCreate(MenuCategoryBase):
    pass


class MenuCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    sort_order: int | None = None


class MenuCategoryRead(MenuCategoryBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class MenuItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    description: str | None = None
    price: int = Field(ge=0)
    is_active: bool = True


class MenuItemCreate(MenuItemBase):
    category_id: int


class MenuItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=180)
    description: str | None = None
    price: int | None = Field(default=None, ge=0)
    image_key: str | None = None
    is_active: bool | None = None
    category_id: int | None = None


class MenuItemRead(MenuItemBase):
    id: int
    category_id: int
    image_key: str | None = None
    image_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class MenuCategoryWithItems(MenuCategoryRead):
    items: list[MenuItemRead] = []


class MenuImageUploadRead(BaseModel):
    image_key: str
    image_url: str