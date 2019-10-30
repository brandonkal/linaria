# API

Linaria exposes a core `css` method alongside with small, but just enough amount of helpers. Inside `linaria` module you can find following methods:

## Client APIs

### `css`

String tag for tagged template literals consisting CSS code. The tagged template literal is evaluated to a unique class name by the Babel plugin:

```js
import { css } from '@brandonkal/linaria';

const flower = css`
  display: inline;
  color: violet;
`;

// flower === flower_9o5awv –> with babel plugin
```

All rules inside the template literal are scoped to the class name, including media queries and animations. For example, we can declare CSS animation like so:

```js
import { css } from '@brandonkal/linaria';

const box = css`
  animation: rotate 1s linear infinite;

  @keyframes rotate {
     {
      from: 0deg;
    }
     {
      to: 360deg;
    }
  }
`;
```

### `cx(...classNames: Array<string | false | void | null | 0>) => string`

Takes a list of class names and returns a concatenated string with the class names. Falsy values are ignored.

```js
import { css, cx } from '@brandonkal/linaria';

const cat = css`
  font-weight: bold;
`;

const yarn = css`
  color: violet;
`;

const fun = css`
  display: flex;
`;

function App({ isPlaying }) {
  return <Playground className={cx(cat, yarn, isPlaying && fun)} />;
}
```

Unlike the [`classnames`](https://www.npmjs.com/package/classnames) library, this doesn't handle objects. If you want need the features of the `classnames` library, you can use it instead.

### `styled`

Helper to build React components. It allows you to write your components in a similar syntax as [`styled-components`](https://www.styled-components.com/):

You can use function interpolations that receive the component's props:

```js
import { styled } from '@brandonkal/linaria/react';
import colors from './colors.json';

const Container = styled.div`
  background-color: ${colors.background};
  color: ${props => props.color};
  width: ${100 / 3}%;
  border: 1px solid red;

  &:hover {
    border-color: blue;
  }

  &${[props => props.large$]} {
    width: ${100 / 2}px;
  }
`;
```

All rules inside the template literal are scoped to the component, much like the `css` tag.

Dynamic function interpolations are replaced with CSS custom properties. Linaria calls your dynamic function interpolation with the component's `props` argument and uses the result as the value for the CSS variable. Styled is a tiny helper function that is imported to avoid duplicating the code for creating the component in all files. This runtime is depency-free.

#### Modifiers

The `styled` function also accepts a modifier shorthand.
This is elegant because it means all style logic can be encapsulated in the CSS.
When the babel plugin encounters an array literal, its first element will be interpolated as a modifier condition. The plugin will statically read the expression to interpolate a development class name. This means you can spend less time thinking about what to name things, and more time thinking about the state that causes a modifier to become active. In the example above, the generated classname will be `bsc0o8j__large_0`:

```js
<Container large$>lorem</Container>
```

```html
<div class="Container_bsc0o8j bsc0o8j__large_0">lorem</div>
OR MINIMIZED
<div class="c c-0">lorem</div>
```

When a modifier evaluates to be truthy, its generated className (and their associated styles) will be applied to the element. Just like dynamic variables, you can use any values that are available at runtime.

#### Shorthand

Writing many arrow functions for interpolations can get a little verbose. `@brandonkal/linaria` supports a shorthand that compiles down to the same arrow function before further evaluation. Here is an example of a Button component:

```js
import { styled } from '@brandonkal/linaria/react';

const Button = (p => styled.div`
  &${[p.kind$ === 'primary']} {
    color: #fff;
    background-color: var(--bc);
    border-color: var(--bc);
    --bc: #1890ff;
  }

  &${[p.size$ === 'large']} {
    height: 40px;
    a& {
      line-height: 38px;
    }
  }

  &${[p.size$ === 'small']} {
    height: 24px;
    a& {
      line-height: 22px;
    }
  }
`)({});

<Button kind$="primary" size$="large">
  Account
</Button>;
```

```html
<button class="Button_bsc0o8j bsc0o8j__size-large_0 bsc0o8j__kind-primary_4">
  Account
</button>
```

Note that this is optional, we could have written `&${[props => props.kind$ === 'primary']}` instead.

By wrapping the styled call inside an IIFE, the props are available in scope so that you remain type-safe.
This IIFE is compiled away during the build.

#### TypeScript

Typescript is supported.

```ts
interface ButtonProps {
  kind$?: 'default' | 'primary' | 'dashed' | 'danger';
  size$?: 'large' | 'default' | 'small';
}
const Button = (p => styled.button<ButtonProps>`
  /* CSS */
  /* the type is accessible directly */
  color: ${btn => (btn.type === 'submit' ? 'red' : 'blue')};
`)({} as ButtonProps);
// The type of Button will be StyledComponent<"button", ButtonProps>
```

#### Components as Selectors

The `styled` function can also interpolate a component to refer to its selector:

```js
const Title = styled.h1`
  font-size: 36px;
`;

const Article = styled.article`
  font-size: 16px;

  /* this will evaluate to the selector that refers to `Title` */
  ${Title} {
    margin-bottom: 24px;
  }
`;
```

If you want to swap out the tag that's rendered, you can use the `as` prop:

```js
// Here `Button` is defined as a `button` tag
const Button = styled.button`
  background-color: rebeccapurple;
`;

// You can switch it to use an `a` tag with the `as` prop
<Button as="a" href="/get-started">
  Click me
</Button>;
```

You can also decorate another styled component with `styled`:

```js
const Button = styled.button`
  background-color: rebeccapurple;
`;

// The background-color in FancyButton will take precedence
const FancyButton = styled(Button)`
  background-color: black;
`;
```

## Server APIs (`linaria/server`)

### `collect(html: string, css: string) => string`

Takes HTML and CSS strings and returns the critical CSS used in the page by analyzing the class names. It can be used to determine critical CSS for server side rendering.

```js
import { collect } from '@brandonkal/linaria/server';

const css = fs.readFileSync('./dist/styles.css', 'utf8');
const html = ReactDOMServer.renderToString(<App />);
const { critical, other } = collect(html, css);

// critical – returns critical CSS for given html
// other – returns the rest of styles
```

This will only detect critical CSS based on class names, so if you have any other type of selectors, they'll get added to the critical CSS.

Also note that extracting critical CSS this way will change the order of class names. It's not a problem if you're primarily using Linaria for styling. However if you're using a third party framework which imports its own CSS, then it's not recommended to use this helper on the extracted CSS.
