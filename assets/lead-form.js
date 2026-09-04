/* Previo lead form: the shared modal behind every high-intent call to action.
 *
 * Usage: give any <button>/<a> a `data-lead="pricing_single"` attribute
 * (pricing_single | pricing_volume | pricing_enterprise | case_study | contact)
 * and include this script. Submissions POST JSON to the lead webhook;
 * on failure the visitor gets the hello@ address so no lead is ever stranded.
 *
 * The dialog is a real dialog: focus moves into it on open, Tab is trapped
 * inside it, the rest of the page is made inert where the browser supports it,
 * the Escape handler is bound on open and removed on close, and focus returns
 * to whatever opened it. It rises into view over 240ms, or appears at once when
 * the visitor asked for reduced motion.
 *
 * No colour and no third-party request live in this file: styling is CSS, and
 * the only network call is the webhook below.
 */
(function () {
    'use strict';

    var ENDPOINT = 'https://api.previo-group.com/webhook';
    var DA = (document.documentElement.lang || '').toLowerCase().indexOf('da') === 0;
    var REDUCE = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var CLOSE_MS = 240; // must not be shorter than the CSS transition
    var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';

    var COPY = {
        heading: {
            pricing_single: DA ? 'Bestil en rapport' : 'Order a report',
            pricing_volume: DA ? 'Volumenpriser' : 'Volume terms',
            pricing_enterprise: DA ? 'Enterprise' : 'Enterprise',
            case_study: DA ? 'Prøv en screening' : 'Request a sample screening',
            contact: DA ? 'Kontakt os' : 'Talk to us'
        },
        sub: DA
            ? 'Udfyld formularen. Vi vender tilbage inden for én arbejdsdag.'
            : 'Leave your details. We reply within one business day.',
        name: DA ? 'Navn' : 'Name',
        email: DA ? 'Arbejdsmail' : 'Work email',
        company: DA ? 'Virksomhed' : 'Company',
        message: DA ? 'Besked (valgfri)' : 'Message (optional)',
        send: DA ? 'Send' : 'Send',
        sending: DA ? 'Sender…' : 'Sending…',
        success: DA
            ? 'Tak. Vi vender tilbage inden for én arbejdsdag.'
            : 'Thank you. We will be in touch within one business day.',
        fail: DA
            ? 'Noget gik galt. Skriv direkte til '
            : 'Something went wrong. Email us directly at '
    };

    var modal = null;
    var card = null;
    var isOpen = false;
    var opener = null;      // the element that opened the dialog, for focus return
    var inerted = [];       // body children switched to inert while the dialog is up
    var closeTimer = null;
    var supportsInert = typeof HTMLElement !== 'undefined' &&
        'inert' in HTMLElement.prototype;

    function build() {
        modal = document.createElement('div');
        modal.className = 'lead-modal';
        modal.innerHTML =
            '<div class="lead-modal-backdrop"></div>' +
            '<div class="lead-modal-card" role="dialog" aria-modal="true" aria-labelledby="leadModalTitle">' +
            '  <button type="button" class="lead-modal-close" aria-label="Close">&times;</button>' +
            '  <h3 id="leadModalTitle"></h3>' +
            '  <p class="lead-modal-sub">' + COPY.sub + '</p>' +
            '  <form class="lead-form" novalidate>' +
            '    <input type="hidden" name="lead_type" value="contact">' +
            '    <input type="text" class="lead-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
            '    <label>' + COPY.name + '<input type="text" name="name" autocomplete="name"></label>' +
            '    <label>' + COPY.email + '<input type="email" name="email" required autocomplete="email"></label>' +
            '    <label>' + COPY.company + '<input type="text" name="company" autocomplete="organization"></label>' +
            '    <label>' + COPY.message + '<textarea name="message" rows="3"></textarea></label>' +
            '    <button type="submit" class="btn btn-primary lead-form-submit">' + COPY.send + '</button>' +
            '    <p class="lead-form-note" hidden></p>' +
            '  </form>' +
            '</div>';

        card = modal.querySelector('.lead-modal-card');

        // Bound once, on the node that lives for the page's lifetime, so
        // reopening never stacks a second set of listeners.
        modal.querySelector('.lead-modal-backdrop').addEventListener('click', close);
        modal.querySelector('.lead-modal-close').addEventListener('click', close);
        modal.querySelector('.lead-form').addEventListener('submit', submit);
    }

    function focusable() {
        return card.querySelectorAll(FOCUSABLE);
    }

    /* Escape closes; Tab and Shift+Tab cycle inside the card and cannot reach
       the page behind it. Bound on open, removed on close. */
    function onKey(e) {
        if (e.key === 'Escape') {
            close();
            return;
        }
        if (e.key !== 'Tab') return;
        var items = focusable();
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];
        var active = document.activeElement;
        if (e.shiftKey && (active === first || !card.contains(active))) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
        }
    }

    // Everything else on the page is taken out of the accessibility tree and out
    // of reach of the pointer while the dialog is up. Skipped where `inert` is
    // unsupported; the focus trap above still holds.
    function setInert(on) {
        if (!supportsInert) return;
        if (on) {
            var kids = document.body.children;
            for (var i = 0; i < kids.length; i++) {
                if (kids[i] !== modal && !kids[i].inert) {
                    kids[i].inert = true;
                    inerted.push(kids[i]);
                }
            }
        } else {
            for (var j = 0; j < inerted.length; j++) inerted[j].inert = false;
            inerted = [];
        }
    }

    function open(leadType, trigger) {
        if (!modal) build();
        if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }
        opener = trigger || document.activeElement;

        modal.querySelector('#leadModalTitle').textContent =
            COPY.heading[leadType] || COPY.heading.contact;
        var form = modal.querySelector('.lead-form');
        form.hidden = false;
        form.reset();
        modal.querySelector('input[name="lead_type"]').value = leadType; // reset() clears it
        var note = modal.querySelector('.lead-form-note');
        note.hidden = true;
        note.textContent = '';

        if (!modal.parentNode) document.body.appendChild(modal);
        // `open` is the display gate, `is-open` is what the CSS transitions on;
        // adding it a frame later gives the transition a state to start from.
        modal.classList.add('open');
        isOpen = true;
        if (REDUCE) {
            modal.classList.add('is-open');
        } else {
            requestAnimationFrame(function () {
                if (isOpen) modal.classList.add('is-open');
            });
        }

        setInert(true);
        document.addEventListener('keydown', onKey);
        modal.querySelector('input[name="name"]').focus();
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        document.removeEventListener('keydown', onKey);
        setInert(false);
        modal.classList.remove('is-open');

        // Let the card settle back before it leaves the document. transitionend
        // is the signal; the timer is the fallback for a browser that never
        // fires one (or a stylesheet with no transition on the card).
        var done = function (ev) {
            // transitionend bubbles, so ignore anything a child transitioned.
            if (ev && ev.target !== card) return;
            if (isOpen) return;
            if (closeTimer) {
                clearTimeout(closeTimer);
                closeTimer = null;
            }
            card.removeEventListener('transitionend', done);
            modal.classList.remove('open');
            if (modal.parentNode) modal.parentNode.removeChild(modal);
        };
        if (REDUCE) {
            done();
        } else {
            card.addEventListener('transitionend', done);
            closeTimer = setTimeout(done, CLOSE_MS + 60);
        }

        if (opener && opener.focus) opener.focus();
        opener = null;
    }

    function submit(e) {
        e.preventDefault();
        var form = e.target;
        var email = form.email.value.trim();
        if (!email || email.indexOf('@') < 1) {
            form.email.focus();
            return;
        }
        var btn = form.querySelector('.lead-form-submit');
        var note = form.querySelector('.lead-form-note');
        btn.disabled = true;
        btn.textContent = COPY.sending;

        fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lead_type: form.lead_type.value,
                name: form.name.value.trim(),
                email: email,
                company: form.company.value.trim(),
                message: form.message.value.trim(),
                website: form.website.value, // honeypot
                page: location.pathname
            })
        }).then(function (res) {
            if (!res.ok) throw new Error('http ' + res.status);
            form.hidden = true;
            note.hidden = false;
            note.className = 'lead-form-note ok';
            note.textContent = COPY.success;
        }).catch(function () {
            note.hidden = false;
            note.className = 'lead-form-note err';
            note.innerHTML = COPY.fail +
                '<a href="mailto:hello@previo-group.com">hello@previo-group.com</a>';
        }).finally(function () {
            btn.disabled = false;
            btn.textContent = COPY.send;
        });
    }

    document.addEventListener('click', function (e) {
        var trigger = e.target.closest && e.target.closest('[data-lead]');
        if (!trigger) return;
        e.preventDefault();
        open(trigger.getAttribute('data-lead'), trigger);
    });
})();
