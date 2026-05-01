import { ComponentContext, IComponent, getStudioProApi } from "@mendix/extensions-api";

export const component: IComponent = {
    async loaded(componentContext: ComponentContext) {

        const studioPro = getStudioProApi(componentContext);
        
        // Add a menu item to the Extensions menu
        await studioPro.ui.extensionsMenu.add({
            menuId: "FavoriteDocs.MainMenu",
            caption: "MyExtension Menu",
            subMenus: [
                {
                    menuId: "FavoriteDocs.ShowMenu",
                    caption: "Show tab",
                    action: async () => {
                        await studioPro.ui.tabs.open(
                            {
                                title: "MyExtension tab"
                            },
                            {
                                componentName: "extension/FavoriteDocs",
                                uiEntrypoint: "tab"
                            }
                        )
                    }
                }
            ],
        });
    }
}


