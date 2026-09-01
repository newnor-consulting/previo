/* Previo lead form — shared modal for high-intent CTAs.
 *
 * Usage: give any <button>/<a> a `data-lead="pricing_single"` attribute
 * (pricing_single | pricing_volume | pricing_enterprise | case_study | contact)
 * and include this script. Submissions POST JSON to the lead webhook;
 * on failure the visitor gets the hello@ address so no lead is ever stranded.
 */
(function () {
    'use strict';

    var ENDPOINT = 'https://api.previo-group.com/webhook';
    var DA = (document.documentElement.lang || '').toLowerCase().indexOf('da') === 0;

    var COPY = {
        heading: {
            pricing_single: DA ? 'Bestil en rapport' : 'Order a report',
            pricing_volume: DA ? 'Volumenpriser' : 'Volume terms',
            pricing_enterprise: DA ? 'Enterprise' : 'Enterprise',
            case_study: DA ? 'Prøv en screening' : 'Request a sample screening',
            contact: DA ? 'Kontakt os' : 'Talk to us'
        },
        sub: DA
            ? 'Udfyld formularen — vi vender tilbage inden for én arbejdsdag.'
            : 'Leave your details — we reply within one business day.',
        name: DA ? 'Navn' : 'Name',
        email: DA ? 'Arbejdsmail' : 'Work email',
        company: DA ? 'Virksomhed' : 'Company',
        message: DA ? 'Besked (valgfri)' : 'Message (optional)',
        send: DA ? 'Send' : 'Send',
        sending: DA ? 'Sender…' : 'Sending…',
        success: DA
            ? 'Tak — vi vender tilbage inden for én arbejdsdag.'
            : 'Thank you — we will be in touch within one business day.',
        fail: DA
            ? 'Noget gik galt. Skriv direkte til '
            : 'Something went wrong. Email us directly at '
    };

    var modal = null;

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
            '    <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;height:0;opacity:0">' +
            '    <label>' + COPY.name + '<input type="text" name="name" autocomplete="name"></label>' +
            '    <label>' + COPY.email + '<input type="email" name="email" required autocomplete="email"></label>' +
            '    <label>' + COPY.company + '<input type="text" name="company" autocomplete="organization"></label>' +
            '    <label>' + COPY.message + '<textarea name="message" rows="3"></textarea></label>' +
            '    <button type="submit" class="btn btn-primary lead-form-submit">' + COPY.send + '</button>' +
            '    <p class="lead-form-note" hidden></p>' +
            '  </form>' +
            '</div>';
        document.body.appendChild(modal);

        modal.querySelector('.lead-modal-backdrop').addEventListener('click', close);
        modal.querySelector('.lead-modal-close').addEventListener('click', close);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') close();
        });
        modal.querySelector('.lead-form').addEventListener('submit', submit);
    }

    function open(leadType) {
        if (!modal) build();
        modal.querySelector('#leadModalTitle').textContent =
            COPY.heading[leadType] || COPY.heading.contact;
        modal.querySelector('input[name="lead_type"]').value = leadType;
        var form = modal.querySelector('.lead-form');
        form.hidden = false;
        form.reset();
        modal.querySelector('input[name="lead_type"]').value = leadType; // reset() clears it
        var note = modal.querySelector('.lead-form-note');
        note.hidden = true;
        note.textContent = '';
        modal.classList.add('open');
        modal.querySelector('input[name="name"]').focus();
    }

    function close() {
        if (modal) modal.classList.remove('open');
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
        var trigger = e.target.closest('[data-lead]');
        if (!trigger) return;
        e.preventDefault();
        open(trigger.getAttribute('data-lead'));
    });
})();
