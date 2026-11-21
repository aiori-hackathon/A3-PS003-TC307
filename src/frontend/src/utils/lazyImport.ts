import React, { lazy } from "react";

/**
 * Wraps named React component exports for React.lazy without duplicating boilerplate
 * across route definitions and dashboard section loaders.
 */
export function lazyNamed<
  TKey extends string,
  TModule extends { [K in TKey]: React.ComponentType<any> },
>(
  loader: () => Promise<TModule>,
  exportName: TKey
): React.LazyExoticComponent<TModule[TKey]> {
  return lazy(async () => {
    const mod = await loader();
    return { default: mod[exportName] };
  });
}
