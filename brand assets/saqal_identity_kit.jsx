#target illustrator
// \u0645\u0644\u0641 \u0627\u0644\u0647\u0648\u064A\u0629 \u0627\u0644\u0625\u0639\u0644\u0627\u0645\u064A\u0629 - \u0628\u0631\u0646\u0627\u0645\u062C \u0635\u0642\u0644
// \u064A\u0628\u0646\u064A \u0644\u0648\u062D\u0627\u062A \u0627\u0644\u0642\u0648\u0627\u0644\u0628 \u0627\u0644\u0625\u0639\u0644\u0627\u0645\u064A\u0629 \u0643\u0640 Artboards \u062F\u0627\u062E\u0644 \u0645\u0633\u062A\u0646\u062F \u062C\u062F\u064A\u062F.
// \u0627\u0644\u062A\u0634\u063A\u064A\u0644: File > Scripts > Other Script... \u062B\u0645 \u0627\u062E\u062A\u0631 \u0647\u0630\u0627 \u0627\u0644\u0645\u0644\u0641.

(function () {
    var C = {
        teal: [0, 114, 142], deep: [0, 111, 140], cyan: [0, 185, 209],
        gold: [251, 180, 43], orange: [247, 152, 69], grey: [141, 141, 141],
        ink: [30, 46, 51], white: [255, 255, 255], mist: [238, 245, 246],
        photo: [170, 190, 197], dark: [59, 74, 80], pale: [229, 240, 242]
    };
    var F_HEAD = "Cairo-Black", F_BOLD = "Tajawal-Bold", F_BODY = "Tajawal-Regular";
    var L, OX, OY, BW, BH;
    var LOGO = {};

    function col(c) {
        var x = new RGBColor();
        x.red = c[0]; x.green = c[1]; x.blue = c[2];
        return x;
    }

    // \u0645\u0633\u062A\u0637\u064A\u0644 \u0628\u0625\u062D\u062F\u0627\u062B\u064A\u0627\u062A \u0623\u0639\u0644\u0649-\u064A\u0633\u0627\u0631 \u062F\u0627\u062E\u0644 \u0627\u0644\u0644\u0648\u062D\u0629
    function rect(x, y, w, h, c) {
        var r = L.pathItems.rectangle(OY - y, OX + x, w, h);
        r.stroked = false;
        r.filled = true;
        r.fillColor = col(c);
        return r;
    }

    // \u0646\u0635: x \u0647\u0648 \u0646\u0642\u0637\u0629 \u0627\u0644\u0645\u0631\u0633\u0627\u0629 (\u064A\u0645\u064A\u0646 \u0644\u0645\u062D\u0627\u0630\u0627\u0629 \u0627\u0644\u064A\u0645\u064A\u0646\u060C \u0627\u0644\u0645\u0646\u062A\u0635\u0641 \u0644\u0645\u062D\u0627\u0630\u0627\u0629 \u0627\u0644\u0648\u0633\u0637)
    function text(s, x, y, size, font, c, align) {
        var t = L.textFrames.pointText([OX + x, OY - y]);
        t.contents = s;
        var ca = t.textRange.characterAttributes;
        ca.size = size;
        ca.fillColor = col(c);
        try { ca.textFont = app.textFonts.getByName(font); } catch (e) {}
        try { t.textRange.paragraphAttributes.justification = align || Justification.LEFT; } catch (e) {}
        return t;
    }

    function recolor(item, c) {
        var i;
        if (item.typename === "GroupItem") {
            for (i = 0; i < item.pageItems.length; i++) recolor(item.pageItems[i], c);
        } else if (item.typename === "CompoundPathItem") {
            for (i = 0; i < item.pathItems.length; i++) recolor(item.pathItems[i], c);
        } else if (item.typename === "PathItem") {
            if (item.filled) item.fillColor = col(c);
        }
    }

    // \u0634\u0639\u0627\u0631: \u064A\u064F\u062F\u0631\u062C \u0643\u0645\u062C\u0645\u0648\u0639\u0629 \u0645\u062A\u062C\u0647\u0629 \u0645\u0639 \u0627\u0644\u062D\u0641\u0627\u0638 \u0639\u0644\u0649 \u0627\u0644\u0646\u0633\u0628\u060C \u0628\u0627\u0631\u062A\u0641\u0627\u0639 h
    function logo(key, x, y, h, c) {
        var g;
        var f = LOGO[key];
        try {
            g = L.groupItems.createFromFile(f);
        } catch (e) {
            g = L.placedItems.add();
            g.file = f;
        }
        var ratio = g.width / g.height;
        g.height = h;
        g.width = h * ratio;
        g.left = OX + x;
        g.top = OY - y;
        if (c) recolor(g, c);
        return g;
    }

    // ---------- \u062A\u0635\u0645\u064A\u0645 \u0627\u0644\u0644\u0648\u062D\u0627\u062A ----------

    function drawCover() {
        rect(0, 0, BW, BH, C.deep);
        rect(BW * 0.55, 0, BW * 0.45, BH, C.cyan);
        logo("v", 90, 90, 400, C.white);
        text("\u0627\u0644\u0641\u0631\u064A\u0642 \u0627\u0644\u0625\u0639\u0644\u0627\u0645\u064A", BW - 90, 170, 16, F_BOLD, C.pale, Justification.RIGHT);
        text("\u0645\u0644\u0641 \u0627\u0644\u0647\u0648\u064A\u0629 \u0627\u0644\u0625\u0639\u0644\u0627\u0645\u064A\u0629", BW - 90, 225, 52, F_HEAD, C.white, Justification.RIGHT);
        text("\u0628\u0631\u0646\u0627\u0645\u062C \u0635\u0642\u0644 \u0644\u062A\u0646\u0645\u064A\u0629 \u0648\u062A\u0623\u0647\u064A\u0644 \u0627\u0644\u0642\u064A\u0627\u062F\u0627\u062A \u0627\u0644\u0634\u0628\u0627\u0628\u064A\u0629", BW - 90, 300, 24, F_BODY, C.white, Justification.RIGHT);
        rect(BW - 230, 340, 140, 7, C.gold);
        text("\u0627\u0644\u0625\u0635\u062F\u0627\u0631 1.0 \u00B7 30 \u0623\u0643\u062A\u0648\u0628\u0631 2026", BW - 90, 400, 15, F_BODY, C.pale, Justification.RIGHT);
    }

    function drawLogos() {
        rect(0, 0, BW, BH, C.white);
        text("\u0627\u0644\u0623\u0634\u0643\u0627\u0644 \u0627\u0644\u062B\u0644\u0627\u062B\u0629 \u0644\u0644\u0634\u0639\u0627\u0631", BW - 80, 70, 30, F_HEAD, C.deep, Justification.RIGHT);
        rect(80, 150, BW - 160, 2, C.gold);
        logo("h", 110, 230, 150, null);
        text("\u0627\u0644\u0634\u0639\u0627\u0631 \u0627\u0644\u0639\u0631\u0636\u064A: \u0644\u0644\u062A\u0631\u0648\u064A\u0633\u0627\u062A \u0648\u0627\u0644\u0645\u0648\u0627\u0642\u0639 \u0648\u0627\u0644\u0645\u0637\u0628\u0648\u0639\u0627\u062A", 110, 430, 16, F_BODY, C.grey);
        logo("v", 480, 200, 240, null);
        text("\u0627\u0644\u0634\u0639\u0627\u0631 \u0627\u0644\u0637\u0648\u0644\u064A: \u0644\u0644\u0633\u062A\u0648\u0631\u064A \u0648\u0627\u0644\u0645\u0633\u0627\u062D\u0627\u062A \u0627\u0644\u0639\u0645\u0648\u062F\u064A\u0629", 480, 470, 16, F_BODY, C.grey);
        logo("i", 860, 210, 200, null);
        text("\u0623\u064A\u0642\u0648\u0646\u0629 \u0627\u0644\u0634\u0639\u0627\u0631: \u0644\u0644\u0645\u0633\u0627\u062D\u0627\u062A \u0627\u0644\u0635\u063A\u064A\u0631\u0629 \u0648\u0627\u0644\u0641\u064A\u062F\u064A\u0648", 860, 430, 16, F_BODY, C.grey);
    }

    function drawColors() {
        rect(0, 0, BW, BH, C.white);
        text("\u0644\u0648\u062D\u0629 \u0627\u0644\u0623\u0644\u0648\u0627\u0646", BW - 80, 70, 30, F_HEAD, C.deep, Justification.RIGHT);
        var list = [
            ["\u0627\u0644\u062A\u064A\u0644 \u0627\u0644\u0623\u0633\u0627\u0633\u064A", C.teal, "#00728E"], ["\u0627\u0644\u062A\u064A\u0644 \u0627\u0644\u062F\u0627\u0643\u0646", C.deep, "#006F8C"],
            ["\u0627\u0644\u0633\u0645\u0627\u0648\u064A", C.cyan, "#00B9D1"], ["\u0627\u0644\u0630\u0647\u0628\u064A", C.gold, "#FBB42B"],
            ["\u0627\u0644\u0628\u0631\u062A\u0642\u0627\u0644\u064A", C.orange, "#F79845"], ["\u0627\u0644\u0631\u0645\u0627\u062F\u064A", C.grey, "#8D8D8D"],
            ["\u0627\u0644\u0646\u0635 \u0627\u0644\u062F\u0627\u0643\u0646 (\u0645\u0642\u062A\u0631\u062D)", C.ink, "#1E2E33"], ["\u0627\u0644\u0623\u0628\u064A\u0636", C.white, "#FFFFFF"]
        ];
        var i, x, y, s;
        for (i = 0; i < list.length; i++) {
            x = 80 + (i % 4) * 250;
            y = 150 + Math.floor(i / 4) * 230;
            rect(x, y, 220, 140, list[i][1]);
            text(list[i][0], x, y + 170, 16, F_BOLD, C.deep);
            text(list[i][2], x, y + 194, 13, F_BODY, C.grey);
            try {
                s = doc.swatches.add();
                s.name = list[i][0];
                s.color = col(list[i][1]);
            } catch (e) {}
        }
    }

    // \u0645\u0646\u0634\u0648\u0631 \u0645\u0631\u0628\u0639 1080
    function drawPost() {
        rect(0, 0, BW, BH, C.white);
        rect(0, 0, BW, 16, C.deep);
        logo("h", 96, 96, 150, null);
        text("\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0642\u0633\u0645 \u0623\u0648 \u0627\u0644\u062A\u0635\u0646\u064A\u0641", 96, 330, 44, F_BOLD, C.teal);
        text("\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0645\u0646\u0634\u0648\u0631 \u0647\u0646\u0627", 96, 420, 104, F_HEAD, C.deep);
        text("\u0646\u0635 \u0641\u0631\u0639\u064A \u064A\u0648\u0636\u062D \u0627\u0644\u0641\u0643\u0631\u0629 \u0641\u064A \u0633\u0637\u0631 \u0623\u0648 \u0633\u0637\u0631\u064A\u0646", 96, 590, 50, F_BODY, C.grey);
        rect(0, BH - 164, BW, 14, C.gold);
        rect(0, BH - 150, BW, 150, C.deep);
        text("\u0635\u0642\u0644 \u0642\u0627\u062F\u0629 \u0627\u0644\u063A\u062F", BW / 2, BH - 75, 58, F_HEAD, C.white, Justification.CENTER);
    }

    // \u0627\u0642\u062A\u0628\u0627\u0633 1080
    function drawQuote() {
        rect(0, 0, BW, BH, C.teal);
        text("\u201C", 90, 360, 300, F_HEAD, C.gold);
        text("\u0646\u0635 \u0627\u0644\u0627\u0642\u062A\u0628\u0627\u0633 \u0623\u0648 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u0645\u0644\u0647\u0645\u0629 \u064A\u0643\u062A\u0628 \u0647\u0646\u0627", 96, 420, 78, F_HEAD, C.white);
        text("\u2014 \u0627\u0633\u0645 \u0635\u0627\u062D\u0628 \u0627\u0644\u0627\u0642\u062A\u0628\u0627\u0633", 96, 800, 44, F_BODY, C.pale);
        logo("i", 96, 880, 110, C.white);
        text("\u0628\u0631\u0646\u0627\u0645\u062C \u0635\u0642\u0644", 260, 950, 40, F_HEAD, C.white);
    }

    // \u0633\u062A\u0648\u0631\u064A 1080x1920
    function drawStory() {
        rect(0, 0, BW, BH, C.teal);
        rect(0, BH * 0.45, BW, BH * 0.55, C.deep);
        logo("v", 276, 260, 520, C.white);
        text("\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062E\u0628\u0631 \u0623\u0648 \u0627\u0644\u0641\u0643\u0631\u0629", BW / 2, 1000, 112, F_HEAD, C.white, Justification.CENTER);
        text("\u0646\u0635 \u0645\u062E\u062A\u0635\u0631 \u064A\u0634\u0631\u062D \u0627\u0644\u0645\u0636\u0645\u0648\u0646", BW / 2, 1150, 52, F_BODY, C.pale, Justification.CENTER);
        rect(90, 1480, BW - 180, 10, C.gold);
        text("\u062A\u0627\u0628\u0639\u0648\u0646\u0627 \u0639\u0644\u0649 \u062D\u0633\u0627\u0628\u0627\u062A\u0646\u0627 \u0627\u0644\u0631\u0633\u0645\u064A\u0629", BW / 2, 1580, 50, F_BOLD, C.white, Justification.CENTER);
    }

    // \u0645\u0646\u0634\u0648\u0631 \u0623\u0641\u0642\u064A 1920x1080
    function drawLand() {
        rect(0, 0, BW, BH, C.white);
        logo("i", 110, 90, 150, null);
        text("\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0642\u0633\u0645", 110, 340, 50, F_BOLD, C.teal);
        text("\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0641\u064A\u062F\u064A\u0648 \u0623\u0648 \u0627\u0644\u0645\u0642\u0627\u0644", 110, 430, 124, F_HEAD, C.deep);
        text("\u0648\u0635\u0641 \u0645\u062E\u062A\u0635\u0631 \u0644\u0644\u0645\u062D\u062A\u0648\u0649 \u0641\u064A \u0633\u0637\u0631 \u0623\u0648 \u0633\u0637\u0631\u064A\u0646", 110, 640, 54, F_BODY, C.grey);
        rect(0, BH - 22, BW, 22, C.gold);
    }

    // \u0625\u0637\u0627\u0631 \u0635\u0648\u0631\u0629 \u0645\u0631\u0628\u0639 (\u0637\u0628\u0642\u0629 \u0641\u0648\u0642 \u0627\u0644\u0635\u0648\u0631\u0629)
    function drawFrameSq() {
        rect(0, 0, BW, BH, C.photo);
        text("\u0645\u0643\u0627\u0646 \u0627\u0644\u0635\u0648\u0631\u0629", BW / 2, 430, 90, F_HEAD, C.dark, Justification.CENTER);
        rect(0, BH - 214, BW, 14, C.gold);
        rect(0, BH - 200, BW, 200, C.deep);
        logo("h", 70, BH - 165, 130, C.white);
    }

    // \u0625\u0637\u0627\u0631 \u0635\u0648\u0631\u0629 \u0633\u062A\u0648\u0631\u064A
    function drawFrameSt() {
        rect(0, 0, BW, BH, C.photo);
        text("\u0645\u0643\u0627\u0646 \u0627\u0644\u0635\u0648\u0631\u0629", BW / 2, 900, 110, F_HEAD, C.dark, Justification.CENTER);
        rect(0, BH - 354, BW, 14, C.gold);
        rect(0, BH - 340, BW, 340, C.deep);
        logo("h", 90, BH - 250, 130, C.white);
    }

    // \u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0628\u062F\u0627\u064A\u0629 1920x1080
    function drawIntro() {
        rect(0, 0, BW, BH, C.white);
        logo("v", BW / 2 - 304, 120, 600, null);
        text("\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062D\u0644\u0642\u0629", BW / 2, 830, 64, F_HEAD, C.deep, Justification.CENTER);
        rect(0, BH - 22, BW, 22, C.teal);
    }

    // \u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u062E\u062A\u0627\u0645 1920x1080
    function drawEnd() {
        rect(0, 0, BW, BH, C.teal);
        logo("h", BW / 2 - 400, 230, 200, C.white);
        text("\u062A\u0627\u0628\u0639\u0648\u0646\u0627 \u0639\u0644\u0649 \u062D\u0633\u0627\u0628\u0627\u062A\u0646\u0627 \u0627\u0644\u0631\u0633\u0645\u064A\u0629", BW / 2, 640, 70, F_HEAD, C.white, Justification.CENTER);
        text("[@\u0627\u0644\u0645\u0639\u0631\u0641] \u00B7 [\u0627\u0644\u0645\u0648\u0642\u0639 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A]", BW / 2, 770, 52, F_BODY, C.pale, Justification.CENTER);
    }

    // \u0627\u0644\u0634\u0631\u064A\u0637 \u0627\u0644\u062A\u0639\u0631\u064A\u0641\u064A (Lower Third) \u0641\u0648\u0642 \u0644\u0642\u0637\u0629 \u0641\u064A\u062F\u064A\u0648
    function drawLower() {
        rect(0, 0, BW, BH, C.dark);
        rect(120, BH - 300, 960, 150, C.white);
        rect(120, BH - 300, 22, 150, C.teal);
        text("\u0627\u0633\u0645 \u0627\u0644\u0645\u062A\u062D\u062F\u062B", 1040, BH - 240, 68, F_HEAD, C.deep, Justification.RIGHT);
        text("\u0627\u0644\u0645\u0633\u0645\u0649 \u0627\u0644\u0648\u0638\u064A\u0641\u064A \u0623\u0648 \u0627\u0644\u062F\u0648\u0631", 1040, BH - 185, 44, F_BODY, C.grey, Justification.RIGHT);
    }

    // ---------- \u0627\u0644\u062A\u0634\u063A\u064A\u0644 ----------

    // macOS \u064A\u0631\u062C\u0639 \u0623\u0633\u0645\u0627\u0621 \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0628\u0635\u064A\u063A\u0629 \u0645\u0634\u0641\u0651\u0631\u0629 (%D8%A7...)\u060C \u0646\u0641\u0643\u0651\u0647\u0627 \u0644\u0644\u0639\u0631\u0628\u064A
    function safeName(s) {
        try { return decodeURI(s); } catch (e) { return s; }
    }

    // \u064A\u0645\u064A\u0651\u0632 \u0627\u0644\u0645\u0644\u0641 \u062D\u0633\u0628 \u0643\u0644\u0645\u0629 \u0641\u064A \u0627\u0633\u0645\u0647
    function assignLogo(f) {
        var n = safeName(f.name);
        if (n.indexOf("\u0627\u0644\u0639\u0631\u0636\u064A") !== -1) LOGO.h = f;      // \u0627\u0644\u0639\u0631\u0636\u064A
        else if (n.indexOf("\u0627\u0644\u0637\u0648\u0644\u064A") !== -1) LOGO.v = f; // \u0627\u0644\u0637\u0648\u0644\u064A
        else if (n.indexOf("\u0627\u064A\u0642\u0648\u0646\u0629") !== -1) LOGO.i = f; // \u0627\u064A\u0642\u0648\u0646\u0629
    }

    // \u064A\u0628\u062D\u062B \u062F\u0627\u062E\u0644 \u0627\u0644\u0645\u062C\u0644\u062F \u0648\u0641\u064A \u0627\u0644\u0645\u062C\u0644\u062F\u0627\u062A \u0627\u0644\u0641\u0631\u0639\u064A\u0629 (\u062D\u062A\u0649 3 \u0645\u0633\u062A\u0648\u064A\u0627\u062A)
    function scan(folder, depth, out) {
        var items = folder.getFiles();
        var i;
        for (i = 0; i < items.length; i++) {
            if (items[i] instanceof Folder) {
                if (depth < 3) scan(items[i], depth + 1, out);
            } else if (items[i] instanceof File && /\.svg$/i.test(items[i].name)) {
                out.push(items[i]);
            }
        }
        return out;
    }

    function logosReady() {
        return !!(LOGO.h && LOGO.v && LOGO.i);
    }

    var folder = Folder.selectDialog("\u0627\u062E\u062A\u0631 \u0645\u062C\u0644\u062F \u0627\u0644\u0634\u0639\u0627\u0631 \u0623\u0648 \u0645\u062C\u0644\u062F brand assets");
    if (!folder) return;

    var found = scan(folder, 0, []);
    var k;
    for (k = 0; k < found.length; k++) assignLogo(found[k]);

    // \u0625\u0630\u0627 \u0645\u0627 \u062A\u0639\u0631\u0651\u0641 \u0639\u0644\u064A\u0647\u0627\u060C \u0646\u0637\u0644\u0628 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u062B\u0644\u0627\u062B\u0629 \u064A\u062F\u0648\u064A\u0627\u064B
    if (!logosReady()) {
        var picked = File.openDialog("\u062D\u062F\u062F \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u062B\u0644\u0627\u062B\u0629: \u0627\u0644\u0634\u0639\u0627\u0631 \u0627\u0644\u0639\u0631\u0636\u064A\u060C \u0627\u0644\u0634\u0639\u0627\u0631 \u0627\u0644\u0637\u0648\u0644\u064A\u060C \u0623\u064A\u0642\u0648\u0646\u0629 \u0627\u0644\u0634\u0639\u0627\u0631", null, true);
        if (picked && picked.length) {
            for (k = 0; k < picked.length; k++) assignLogo(picked[k]);
        }
    }

    if (!logosReady()) {
        var names = [];
        for (k = 0; k < found.length; k++) names.push(safeName(found[k].name));
        alert("\u0645\u0627 \u0642\u062F\u0631\u062A \u0623\u062A\u0639\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u062B\u0644\u0627\u062B\u0629.\n\u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0644\u064A \u0644\u0642\u064A\u062A\u0647\u0627: " + (names.length ? names.join(" | ") : "\u0644\u0627 \u064A\u0648\u062C\u062F \u0623\u064A \u0645\u0644\u0641 SVG"));
        return;
    }

    var doc = app.documents.add(DocumentColorSpace.RGB, 1200, 800, 1);
    var boards = [
        { name: "\u063A\u0644\u0627\u0641", w: 1123, h: 794, fn: drawCover },
        { name: "\u0627\u0644\u0634\u0639\u0627\u0631", w: 1123, h: 794, fn: drawLogos },
        { name: "\u0627\u0644\u0623\u0644\u0648\u0627\u0646", w: 1123, h: 794, fn: drawColors },
        { name: "\u0645\u0646\u0634\u0648\u0631 \u0645\u0631\u0628\u0639 1080", w: 1080, h: 1080, fn: drawPost },
        { name: "\u0627\u0642\u062A\u0628\u0627\u0633 1080", w: 1080, h: 1080, fn: drawQuote },
        { name: "\u0633\u062A\u0648\u0631\u064A 1080x1920", w: 1080, h: 1920, fn: drawStory },
        { name: "\u0645\u0646\u0634\u0648\u0631 \u0623\u0641\u0642\u064A 1920x1080", w: 1920, h: 1080, fn: drawLand },
        { name: "\u0625\u0637\u0627\u0631 \u0635\u0648\u0631\u0629 \u0645\u0631\u0628\u0639", w: 1080, h: 1080, fn: drawFrameSq },
        { name: "\u0625\u0637\u0627\u0631 \u0635\u0648\u0631\u0629 \u0633\u062A\u0648\u0631\u064A", w: 1080, h: 1920, fn: drawFrameSt },
        { name: "\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0628\u062F\u0627\u064A\u0629", w: 1920, h: 1080, fn: drawIntro },
        { name: "\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u062E\u062A\u0627\u0645", w: 1920, h: 1080, fn: drawEnd },
        { name: "\u0627\u0644\u0634\u0631\u064A\u0637 \u0627\u0644\u062A\u0639\u0631\u064A\u0641\u064A", w: 1920, h: 1080, fn: drawLower }
    ];

    var COLS = 3, GAP = 200, CELL = 2200;
    var i, b, row, colIdx, ab;
    for (i = 0; i < boards.length; i++) {
        b = boards[i];
        row = Math.floor(i / COLS);
        colIdx = i % COLS;
        var left = colIdx * CELL;
        var top = -row * CELL;
        var rectAB = [left, top, left + b.w, top - b.h];
        if (i === 0) {
            ab = doc.artboards[0];
            ab.artboardRect = rectAB;
        } else {
            ab = doc.artboards.add(rectAB);
        }
        ab.name = b.name;
    }

    for (i = 0; i < boards.length; i++) {
        b = boards[i];
        doc.artboards.setActiveArtboardIndex(i);
        var abRect = doc.artboards[i].artboardRect; // [left, top, right, bottom]
        OX = abRect[0];
        OY = abRect[1];
        BW = b.w;
        BH = b.h;
        L = doc.layers.add();
        L.name = b.name;
        b.fn();
    }

    alert("\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 " + boards.length + " \u0644\u0648\u062D\u0629 \u0642\u0648\u0627\u0644\u0628 \u0641\u064A \u0627\u0644\u0645\u0633\u062A\u0646\u062F. \u0627\u0644\u062E\u0637\u0648\u0637 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629: Cairo \u0648Tajawal.");
})();
