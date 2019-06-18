# Part 0: Setting Up

## Installation

Initialize the repo with a `package.json` via NPM, filling in the basic metadata required to configure the project

```
npm init
```

Optional but recommended: Replace the `version` field in the `package.json` with `private: true`. This prevents accidental publishing to the NPM registry. This codebase should be considered an app not a library, so we don’t want it to be installable as a package.

## Setting up Parcel

[Parcel](https://parceljs.org/) is a development tool that handles building and reloading files in development and bundling the output files for publishing on the web.

Install Parcel using the following command:

```
npm install -g parcel-bundler
```

Try to ignore the ridiculous number of packages that get downloaded. Welcome to the wonderful world of JavaScript UI development, circa 2019. Other people much smarter than me have posted [salient criticism](https://twitter.com/garybernhardt/status/1137459482135416832) of the [problems of this style](https://twitter.com/hillelogram/status/1137775945148960768), but we need to roll with it if we want to take advantage of useful development features like [hot module replacement](https://parceljs.org/hmr.html).

To set up Parcel, we need to provide two script entry points: a command to run the game in development, and a command to compile and bundle the game as a static website for production.

The following script block in the `package.json` will accomplish this:

```json
{
  "scripts": {
    "start": "parcel src/index.html",
    "build": "parcel build src/index.html"
  }
}
```

## Adding the entry point

Now we need to boostrap the game itself with an HTML template skeleton and a top level JavaScript entry point.

Create a new `src` directory with the following two files in it:

- `index.html`
- `index.js`

The HTML template `src/index.html` should contain something like the following:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>roguelike-tutorial</title>
  </head>
  <body>
    <script src="./index.js"></script>
  </body>
</html>
```

The JavaScript entry point `src/index.js` should contain a basic ‘Hello World’ using `console.log` or `alert` to ensure that the whole thing works:

```js
// Log keypress events to the console
document.addEventListener("keydown", ev => console.log(ev.key));
```

## Starting the development server

Following the steps above, we should have a `start` script in the `package.json` that points Parcel to the entry point at `src/index.html`. To kick things off, run the following script:

```
npm start
```

This will compile the app and start a development server on port `1234` by default.

Go to `http://localhost:1234/` in a web browser to view the running app. To test out the example given above, open the browser DevTools, then press various keys on the keyboard, and watch the console to ensure that the stream of key names are printed out in response to the keypress events.

## Minutia

To avoid various bits of generated code and temporary files ending up in the Git repo, it’s useful to add a `.gitignore` file.

When working with Parcel, the following `.gitignore` entries are a useful starting point:

```
/.cache
/dist
```

## Ready to go?

If everything here is working, we can move on to Part 1.
