/**
 * React 19 no longer publishes a global `JSX` namespace.
 * JSDoc such as `@returns {JSX.Element}` looks up that global name,
 * so this alias points it at `React.JSX`.
 */
declare global {
  namespace JSX {
    type Element = import('react').JSX.Element;
    type ElementType = import('react').JSX.ElementType;
    interface ElementClass extends import('react').JSX.ElementClass {}
    interface ElementAttributesProperty
      extends import('react').JSX.ElementAttributesProperty {}
    interface ElementChildrenAttribute
      extends import('react').JSX.ElementChildrenAttribute {}
    type LibraryManagedAttributes<C, P> =
      import('react').JSX.LibraryManagedAttributes<C, P>;
    interface IntrinsicAttributes
      extends import('react').JSX.IntrinsicAttributes {}
    interface IntrinsicClassAttributes<T>
      extends import('react').JSX.IntrinsicClassAttributes<T> {}
    interface IntrinsicElements extends import('react').JSX.IntrinsicElements {}
  }
}

export {};
