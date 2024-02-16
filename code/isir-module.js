//****************************
// Module for ISIR record field read, validation, and update
//
// Definitions for sections and fields is generated (transpiled)
// from the [2024–25 Final ISIR Record Layout in Excel Format, 96KB](https://fsapartners.ed.gov/sites/default/files/2023-11/2024-25ISIRNov2023.xlsx)
// definition of ISIR Layout Volume 4 specification.
//


/**
 * Extract raw string value from ISIR frame at field position
 * @param {ISIRField} field
 * @param {string} isir_frame
 * @returns {string}
 */
export function isir_field_read_raw(field, isir_frame) {
    return isir_frame.substring(field.pos_start, field.pos_end)
}

/**
 * Extract field value from ISIR frame using field validation
 * @param {ISIRField} field
 * @param {string} isir_frame
 * @param {*} mode - see {@link isir_field_validate}
 * @returns {*} - string if mode is falsey, result of {@link isir_field_validate} otherwise
 */
export function isir_field_read(field, isir_frame, mode) {
    let sz_value = isir_field_read_raw(field, isir_frame)
    let res = isir_field_validate(field, sz_value, mode)
    return false == mode ? res : res.value
}

/**
 * Validate `value` using field specific logic.
 * Used in field read and update operations.
 * 
 * Upon failed validation, mode determines next action:
 *   if mode is false or 'ignore', no action and proceed
 *   if mode.set is a function, invoke to collect errors by field (Map protocol compatible)
 *   if mode == 'warn', use `console.warn` and proceed
 *   otherwise or mode == null, throw error
 * 
 * @param {ISIRField} field
 * @param {string} value -- for validation against field
 * @param {*} mode -- options for handling validation errors
 * @returns {value: string, field: ISIRField, result?:*, invalid?:bool|string}
 */
export function isir_field_validate(field, value, mode) {
    value = `${value}`.trim()

    let valid = field.validate?.(value, field)
    let res = {value, field}
    if (null == valid) return res
    if ('object' == typeof valid) {
        res.result = valid.result
        valid = valid.valid ?? true
    }

    if (false != valid) {
        res.invalid = false
        return res // return affirmative validation result
    }

    res.invalid = `f_${field.idx} raw: ${JSON.stringify(value)}`
    if (false == mode || 'ignore' == mode) {
        // passthrough
    } else if (mode?.set) {
        mode.set(field, value) // a map
    } else {
        let msg_invalid = `ISIR field f_${field.idx}[${field.name}] failed validation`
        if (mode=='warn')
            console.warn('%s (value: %o)', msg_invalid, value, field)
        else throw new Error(`${msg_invalid} (value: ${JSON.stringify(value)})`)
    }
    return res // return negative validation result
}

/**
 * Pack string value into field length.
 * Throws error when longer than available length.
 * @param {ISIRField} field
 * @param {string} value
 * @returns {string} - packed to field length
 */
export function _isir_field_pack_value(field, value) {
    let update = `${value}`.padEnd(field.len, ' ')
    if (update.length !== field.len) {
        let err = new Error('Invalid update length')
        err.info = {field_len: field.len, update_len:update.length, update, field}
        throw err
    }
    return update
}

/**
 * Update ISIR frame at field position with `update` string.
 * Throws error when `isir_frame` length invariant changes.
 * @param {ISIRField} field
 * @param {string} isir_frame
 * @param {string} update - value packed to field length
 * @returns {string} - of updated isir_frame
 */
export function _isir_field_raw_splice(field, isir_frame, update) {
    let new_frame = isir_frame.substring(0, field.pos_start)
    new_frame += update
    new_frame += isir_frame.substring(field.pos_end)
    if (new_frame.length != isir_frame.length)
        throw new Error("Frame length change")
    return new_frame
}

/**
 * Update ISIR frame field using `value` *without* validation
 * Throws error when `isir_frame` length invariant changes.
 * @param {ISIRField} field
 * @param {string} isir_frame
 * @param {string} value
 * @returns {string} - of updated isir_frame
 */
export function isir_field_update_raw(field, isir_frame, value) {
    let sz_value = _isir_field_pack_value(field, value)
    return _isir_field_raw_splice(field, isir_frame, sz_value)
}

/**
 * Update ISIR frame field using `value` with validation
 * Throws error when `isir_frame` length invariant changes.
 * @param {ISIRField} field
 * @param {string} isir_frame
 * @param {string} value
 * @returns {string} - of updated isir_frame
 */
export function isir_field_update(field, isir_frame, value, mode) {
    let sz_value = _isir_field_pack_value(field, value)
    let res = isir_field_validate(field, sz_value, mode)
    let isir = _isir_field_raw_splice(field, isir_frame, sz_value)
    return false == mode ? [isir, res.error, res] : isir
}


let _isir_blank // cache blank ISIR frame
/**
 * Return a new blank ISIR frame using field definitions
 * @returns string - isir_frame with spec defaults
 */
export function isir_blank() {
  if (!_isir_blank) {
    _isir_blank = ''
    for (let field of isir_record_fields)
        if (!field) ;
        else if (field.empty)
            _isir_blank += field.empty
        else if (field.expect)
            _isir_blank += `${field.expect}`.padEnd(field.len, ' ')
        else _isir_blank += ' '.repeat(field?.len || 0)
  }
  return _isir_blank
}


/**
 * Load all ISIR fields by section from an ISIR frame, performing validation
 * @param {string} isir_frame
 * @param {*} options
 * @returns {*}
 */
export function isir_load_report(isir_frame, opt) {
    return isir_record_sections.map(section =>
        isir_section_report(section, isir_frame, opt))
}

/**
 * Load all ISIR fields of a section from an ISIR frame, performing validation
 * @param {ISIRSection} section
 * @param {string} isir_frame
 * @param {*} options
 * @returns {*}
 */
export function isir_section_report(section, isir_frame, opt={}) {
    let {mode, skip_empty} = opt.trim ? {mode: opt} : opt
    let res_fields = [], non_empty=0, pos_start=isir_frame.length, pos_end=0
    for (let field of section.field_list) {
        //let {idx, name, alias, len} = field
        let sz_value = isir_field_read_raw(field, isir_frame)
        let res = isir_field_validate(field, sz_value, mode)

        if (null != res.value && (! /^0*$/.test(res.value)) && !field.non_content) {
            non_empty++
            res_fields.push(res)
        } else if (!skip_empty) {
            res_fields.push(res)
        }
    }
    return {__proto__: section, non_empty, fields: res_fields}
}

/**
 * Load all ISIR fields into structured JSON from an ISIR frame, performing validation
 * @param {string} isir_frame
 * @param {*} options
 * @returns {*}
 */
export function isir_load_json(isir_frame, opt) {
    let isir_res = {__proto__: {isir: isir_frame}}
    for (let section of isir_record_sections) {
        let sect_res = isir_section_json(section, isir_frame, opt)
        _isir_set_path(isir_res, section.path, sect_res)
    }
    return isir_res
}

/**
 * Load all ISIR fields for a section into structured JSON from an ISIR frame, performing validation
 * @param {ISIRSection} section
 * @param {string} isir_frame
 * @param {*} options - for {mode} option, see parameter from {@link isir_field_validate}
 * @returns {*}
 */
export function isir_section_json(section, isir_frame, opt={}) {
    let {mode, skip_empty} = opt.trim ? {mode: opt} : opt
    let sect_res = {__proto__: {section}}

    for (let field of section.field_list) {
        if ( field.non_content ) continue; // then skip

        let value = isir_field_read(field, isir_frame, mode)
        if (!skip_empty || value || (null != value && '' != value))
            _isir_set_path(sect_res, field.path, value)
    }

    return sect_res
}


const _absent_fill = (tgt, key, as_obj) => tgt[key] = ({}) // (as_obj ? {} : [])
/**
 * (Advanced) Utility for creating ISIR structure from section paths and field paths. 
 * Cross reference with use in {@link isir_section_json} and {@link _init_isir_model}
 */
export function _isir_set_path(tip_obj, key_path, value, absent=_absent_fill) {
    let key, last_obj=tip_obj, idx_last = key_path.length-1

    for (let key_idx=0; key_idx<idx_last; key_idx++) {
        key = key_path[key_idx]
        tip_obj = (last_obj = tip_obj)[ key ]
        if (undefined === tip_obj)
          tip_obj = absent(last_obj, key, !isNaN(key_path[key_idx+1]), key_idx, key_path)
    }

    key = key_path[idx_last]
    if (null != key)
      tip_obj[ key ] = value

    return tip_obj
}


let _isir_proto_
/**
 * Load an ISIR structured object model from an ISIR frame
 * @param {string} isir_frame
 * @returns {*}
 */
export function isir_model_from(isir_frame) {
  _isir_proto_ ??= _init_isir_model()
  return Object.create(_isir_proto_, {$: {value: [isir_frame]}})
}

/**
 * (Advanced) Utility for creating ISIR model prototypes from section paths and field paths. 
 */
function _init_isir_model() {
  let by_field_idx = {}, propByField = new Map()
  for (let field of isir_record_fields)
    if (null != field)
      propByField.set(field, 
        by_field_idx['f_'+field.idx] = _isir_field_prop(field))


  // structured object
  let _fixup_structure = []
  const _absent_structure = (tgt, key) => {
    let grp = tgt[key] = {}
    _fixup_structure.push([grp, [tgt, key]])
    return grp }

  let by_path = {}
  for (let section of isir_record_sections) {
    let sect_props = _isir_set_path(by_path, section.path.concat(null), void 0, _absent_structure)

    for (let field of section.field_list)
        if (field.path)
          _isir_set_path(sect_props, field.path, {enumerable: true, ... propByField.get(field)}, _absent_structure)
  }

  for (let rec of _fixup_structure) {
    let [tgt, key] = rec.pop()

    // (Subtle) lazily create nested accessor objects using prototypes and shared mutable
    tgt[key] = { get() { return Object.create(null, {$: {value: this.$}, ...rec[0]}) }, enumerable: true }
  }

  // (Subtle) create accessor object using prototypes and shared mutable
  return Object.create(null, {...by_path, ...by_field_idx})

  function _isir_field_prop(field, kw) {
    let prop = { ... kw,
        get() { 
            let sz_value = isir_field_read_raw(field, this.$[0])
            let field_res = isir_field_validate(field, sz_value)
            return field_res },
        set(value) {
            return this.$[0] = isir_field_update(field, this.$[0], value) },
    }
    return prop
  }
}


//****************************
// ISIR field validator logic implementations
//

const _validate_expect = (sz_value, field) => sz_value == field.expect

const _rx_school_code = /^[0BEG]\d{5}$|^$/
const _validate_school_code = (sz_value) => _rx_school_code.test(sz_value)

function _check_date(sz) {
    if ('' == sz) return;
    let sz_iso = sz.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
    let dt = new Date(sz_iso+'T00:00:00Z')
    let [rt_sz] = isNaN(dt) ? '' : dt.toISOString().split('T',1)
    let valid = sz_iso == rt_sz
    return valid && {valid, result: sz_iso}
}
const _validate_date = (sz_value, field) => _validate_options(sz_value, field) && _check_date(sz_value)
const _validate_yearmonth = (sz_value, field) => _validate_options(sz_value, field) && _check_date(sz_value.length==6 ? sz_value+'01' : sz_value)
const _validate_fixed_decimal = (sz_value) => /\d*/.test(sz_value)
const _validate_correction = (sz_value) => {}

function _check_range(value, min, max) {
    value = parseInt(value)
    let valid = Number.isFinite(value) && parseInt(min) <= value && value <= parseInt(max)
    return valid && {valid, result: value}
}

const _validate_by_op = {
    uuid: (sz_value) => /^[0-9a-fA-Z]{8}-[0-9a-fA-Z]{4}-[0-9a-fA-Z]{4}-[0-9a-fA-Z]{4}-[0-9a-fA-Z]{12}$/.test(sz_value),
    email: (sz_value) => /^[^@]+@[^@]+$/.test(sz_value),
    numeric: (sz_value) => {
        let valid = /^[0-9\-]+$/.test(sz_value)
        return valid && {valid, result: parseInt(sz_value)}
    },
    alpha: (sz_value) => /^[A-Za-z_\- ]+$/.test(sz_value),
    alphanumeric: (sz_value) => /^[0-9A-Za-z_\- ]+$/.test(sz_value),
    enum: (sz_value, op) => {
        if (!Object.hasOwn(op.options, sz_value))
            sz_value = sz_value.replace(/^0+/,'')

        let valid = Object.hasOwn(op.options, sz_value)
        return valid && {valid, result: op.options[sz_value]}
    },
    range: (sz_value, op) => _check_range(sz_value, op.min, op.max),
    year: (sz_value) => _check_range(sz_value, 1900, 2100),
    date: (sz_value) => _check_date(sz_value),
    dhs_case_number: (sz_value) => /[0-9]{13}[A-Z]{2}/.test(sz_value),
    eti_destination: (sz_value) => /[A-Z]{2}[0-9A-Za-z]{5}/.test(sz_value),
}
function _validate_options(sz_value, field) {
    // Many fields are allowed to be blank, but not marked as such in the spec
    if ('' === sz_value) return field.allow_blank || void 0;

    let op, res
    for (op of field.options) {
        if (null == _validate_by_op[op.op])
            console.warn('Missing validate op', op)
        else if (res = _validate_by_op[op.op](sz_value, op))
            return res
    }

    return false
}


export const valid_country_codes = {
  '': 1, // BLANK

  'AF': 1, // Afghanistan
  'AX': 1, // Aland Islands
  'AL': 1, // Albania
  'DZ': 1, // Algeria
  'AS': 1, // American Samoa
  'AD': 1, // Andorra
  'AO': 1, // Angola
  'AI': 1, // Anguilla
  'AQ': 1, // Antarctica
  'AG': 1, // Antigua and Barbuda
  'AR': 1, // Argentina
  'AM': 1, // Armenia
  'AW': 1, // Aruba
  'AU': 1, // Australia
  'AT': 1, // Austria
  'AZ': 1, // Azerbaijan
  'BS': 1, // Bahamas
  'BH': 1, // Bahrain
  'BD': 1, // Bangladesh
  'BB': 1, // Barbados
  'BY': 1, // Belarus
  'BE': 1, // Belgium
  'BZ': 1, // Belize
  'BJ': 1, // Benin
  'BM': 1, // Bermuda
  'BT': 1, // Bhutan
  'BO': 1, // Bolivia
  'BQ': 1, // Bonaire, Sint Eustatius, and Saba
  'BA': 1, // Bosnia and Herzegovina
  'BW': 1, // Botswana
  'BV': 1, // Bouvet Island
  'BR': 1, // Brazil
  'IO': 1, // British Indian Ocean Territory
  'BN': 1, // Brunei Darussalam
  'BG': 1, // Bulgaria
  'BF': 1, // Burkina Faso
  'BI': 1, // Burundi
  'KH': 1, // Cambodia
  'CM': 1, // Cameroon
  'CA': 1, // Canada
  'CV': 1, // Cape Verde
  'KY': 1, // Cayman Islands
  'CF': 1, // Central African Republic
  'TD': 1, // Chad
  'CL': 1, // Chile
  'CN': 1, // China
  'CX': 1, // Christmas Island
  'CC': 1, // Cocos (Keeling) Islands
  'CO': 1, // Colombia
  'KM': 1, // Comoros
  'CG': 1, // Congo
  'CD': 1, // Congo, The Democratic Republic of the
  'CK': 1, // Cook Islands
  'CR': 1, // Costa Rica
  'CI': 1, // Cote D’Ivoire
  'HR': 1, // Croatia
  'CU': 1, // Cuba
  'CW': 1, // Curacao
  'CY': 1, // Cyprus
  'CZ': 1, // Czech Republic
  'DK': 1, // Denmark
  'DJ': 1, // Djibouti
  'DM': 1, // Dominica
  'DO': 1, // Dominican Republic
  'EC': 1, // Ecuador
  'EG': 1, // Egypt
  'SV': 1, // El Salvador
  'GQ': 1, // Equatorial Guinea
  'ER': 1, // Eritrea
  'EE': 1, // Estonia
  'ET': 1, // Ethiopia
  'FK': 1, // Falkland Islands (Malvinas)
  'FO': 1, // Faroe Islands
  'FJ': 1, // Fiji
  'FI': 1, // Finland
  'FR': 1, // France
  'GF': 1, // French Guiana
  'PF': 1, // French Polynesia
  'TF': 1, // French Southern Territories
  'GA': 1, // Gabon
  'GM': 1, // Gambia
  'GE': 1, // Georgia
  'DE': 1, // Germany
  'GH': 1, // Ghana
  'GI': 1, // Gibraltar
  'GR': 1, // Greece
  'GL': 1, // Greenland
  'GD': 1, // Grenada
  'GP': 1, // Guadeloupe
  'GU': 1, // Guam
  'GT': 1, // Guatemala
  'GG': 1, // Guernsey
  'GN': 1, // Guinea
  'GW': 1, // Guinea-Bissau
  'GY': 1, // Guyana
  'HT': 1, // Haiti
  'HM': 1, // Heard Island and McDonald Islands
  'VA': 1, // Holy See (Vatican City State)
  'HN': 1, // Honduras
  'HK': 1, // Hong Kong
  'HU': 1, // Hungary
  'IS': 1, // Iceland
  'IN': 1, // India
  'ID': 1, // Indonesia
  'IR': 1, // Iran, Islamic Republic of
  'IQ': 1, // Iraq
  'IE': 1, // Ireland
  'IM': 1, // Isle of Man
  'IL': 1, // Israel
  'IT': 1, // Italy
  'JM': 1, // Jamaica
  'JP': 1, // Japan
  'JE': 1, // Jersey
  'JO': 1, // Jordan
  'KZ': 1, // Kazakhstan
  'KE': 1, // Kenya
  'KI': 1, // Kiribati
  'KP': 1, // Korea, Democratic People’s Republic of
  'KR': 1, // Korea, Republic of
  'KW': 1, // Kuwait
  'KG': 1, // Kyrgyzstan
  'LA': 1, // Lao People’s Democratic Republic
  'LV': 1, // Latvia
  'LB': 1, // Lebanon
  'LS': 1, // Lesotho
  'LR': 1, // Liberia
  'LI': 1, // Liechtenstein
  'LT': 1, // Lithuania
  'LU': 1, // Luxembourg
  'MO': 1, // Macao
  'MK': 1, // Macedonia, The Former Yugoslav Republic of
  'MG': 1, // Madagascar
  'MW': 1, // Malawi
  'MY': 1, // Malaysia
  'MV': 1, // Maldives
  'ML': 1, // Mali
  'MT': 1, // Malta
  'MH': 1, // Marshall Islands
  'MQ': 1, // Martinique
  'MR': 1, // Mauritania
  'MU': 1, // Mauritius
  'YT': 1, // Mayotte
  'MX': 1, // Mexico
  'FM': 1, // Micronesia, Federated States of
  'MD': 1, // Moldova
  'MC': 1, // Monaco
  'MN': 1, // Mongolia
  'ME': 1, // Montenegro
  'MS': 1, // Montserrat
  'MA': 1, // Morocco
  'MZ': 1, // Mozambique
  'MM': 1, // Myanmar
  'NA': 1, // Namibia
  'NR': 1, // Nauru
  'NP': 1, // Nepal
  'NL': 1, // Netherlands
  'NC': 1, // New Caledonia
  'NZ': 1, // New Zealand
  'NI': 1, // Nicaragua
  'NE': 1, // Niger
  'NG': 1, // Nigeria
  'NU': 1, // Niue
  'NF': 1, // Norfolk Island
  'MP': 1, // Northern Mariana Islands
  'NO': 1, // Norway
  'OM': 1, // Oman
  'PK': 1, // Pakistan
  'PW': 1, // Palau
  'PS': 1, // Palestinian Territory, Occupied
  'PA': 1, // Panama
  'PG': 1, // Papua New Guinea
  'PY': 1, // Paraguay
  'PE': 1, // Peru
  'PH': 1, // Philippines
  'PN': 1, // Pitcairn
  'PL': 1, // Poland
  'PT': 1, // Portugal
  'PR': 1, // Puerto Rico
  'QA': 1, // Qatar
  'RE': 1, // Reunion
  'RO': 1, // Romania
  'RU': 1, // Russian Federation
  'RW': 1, // Rwanda
  'BL': 1, // Saint Barthelemy
  'SH': 1, // Saint Helena
  'KN': 1, // Saint Kitts And Nevis
  'LC': 1, // Saint Lucia
  'MF': 1, // Saint Martin
  'PM': 1, // Saint Pierre and Miquelon
  'VC': 1, // Saint Vincent and The Grenadines
  'WS': 1, // Samoa
  'SM': 1, // San Marino
  'ST': 1, // Sao Tome And Principe
  'SA': 1, // Saudi Arabia
  'SN': 1, // Senegal
  'RS': 1, // Serbia
  'SC': 1, // Seychelles
  'SL': 1, // Sierra Leone
  'SG': 1, // Singapore
  'SK': 1, // Slovakia
  'SI': 1, // Slovenia
  'SB': 1, // Solomon Islands
  'SO': 1, // Somalia
  'ZA': 1, // South Africa
  'GS': 1, // South Georgia and the South Sandwich Islands
  'SS': 1, // South Sudan
  'ES': 1, // Spain
  'LK': 1, // Sri Lanka
  'SD': 1, // Sudan
  'SR': 1, // Suriname
  'SJ': 1, // Svalbard and Jan Mayen
  'SZ': 1, // Swaziland
  'SE': 1, // Sweden
  'CH': 1, // Switzerland
  'SY': 1, // Syrian Arab Republic
  'TW': 1, // Taiwan
  'TJ': 1, // Tajikistan
  'TZ': 1, // Tanzania, United Republic of
  'TH': 1, // Thailand
  'TL': 1, // Timor-Leste
  'TG': 1, // Togo
  'TK': 1, // Tokelau
  'TO': 1, // Tonga
  'TT': 1, // Trinidad And Tobago
  'TN': 1, // Tunisia
  'TR': 1, // Turkey
  'TM': 1, // Turkmenistan
  'TC': 1, // Turks And Caicos Islands
  'TV': 1, // Tuvalu
  'UG': 1, // Uganda
  'UA': 1, // Ukraine
  'SX': 1, // Union of Soviet Soc Rep
  'AE': 1, // United Arab Emirates
  'GB': 1, // United Kingdom
  'US': 1, // United States
  'UM': 1, // United States Minor Outlying Islands
  'UY': 1, // Uruguay
  'UZ': 1, // Uzbekistan
  'VU': 1, // Vanuatu
  'VE': 1, // Venezuela
  'VN': 1, // Viet Nam
  'VG': 1, // Virgin Islands, British
  'VI': 1, // Virgin Islands, U.S.
  'WF': 1, // Wallis And Futuna
  'EH': 1, // Western Sahara
  'YD': 1, // Yemen Democratic
  'ZM': 1, // Zambia
  'ZW': 1, // Zimbabwe
}
const _validate_country_codes = (sz_value) => 1 === valid_country_codes[sz_value]

export const valid_state_codes = {
  '': 1, // BLANK

  'AL': 1, // Alabama
  'AK': 1, // Alaska
  'AS': 1, // American Samoa
  'AZ': 1, // Arizona
  'AR': 1, // Arkansas
  'CA': 1, // California
  'CO': 1, // Colorado
  'CT': 1, // Connecticut
  'DE': 1, // Delaware
  'DC': 1, // District of Columbia
  'FM': 1, // Federated States of Micronesia
  'FL': 1, // Florida
  'GA': 1, // Georgia
  'GU': 1, // Guam
  'HI': 1, // Hawaii
  'ID': 1, // Idaho
  'IL': 1, // Illinois
  'IN': 1, // Indiana
  'IA': 1, // Iowa
  'KS': 1, // Kansas
  'KY': 1, // Kentucky
  'LA': 1, // Louisiana
  'ME': 1, // Maine
  'MH': 1, // Marshall Islands
  'MD': 1, // Maryland
  'MA': 1, // Massachusetts
  'MI': 1, // Michigan
  'MN': 1, // Minnesota
  'MS': 1, // Mississippi
  'MO': 1, // Missouri
  'MT': 1, // Montana
  'NE': 1, // Nebraska
  'NV': 1, // Nevada
  'NH': 1, // New Hampshire
  'NJ': 1, // New Jersey
  'NM': 1, // New Mexico
  'NY': 1, // New York
  'NC': 1, // North Carolina
  'ND': 1, // North Dakota
  'MP': 1, // Northern Mariana Islands
  'OH': 1, // Ohio
  'OK': 1, // Oklahoma
  'OR': 1, // Oregon
  'PA': 1, // Pennsylvania
  'PR': 1, // Puerto Rico
  'PW': 1, // Republic of Palau
  'RI': 1, // Rhode Island
  'SC': 1, // South Carolina
  'SD': 1, // South Dakota
  'TN': 1, // Tennessee
  'TX': 1, // Texas
  'VI': 1, // U.S. Virgin Islands
  'UT': 1, // Utah
  'VT': 1, // Vermont
  'VA': 1, // Virginia
  'WA': 1, // Washington
  'WV': 1, // West Virginia
  'WI': 1, // Wisconsin
  'WY': 1, // Wyoming

  // Armed Forces State Codes
  'AA': 1, // Armed Forces Americas (except Canada)
  'AE': 1, // Armed Forces Europe, Middle East, and Canada
  'AP': 1, // Armed Forces Pacific

  // Canadian Province State Codes
  'AB': 1, // Alberta
  'BC': 1, // British Columbia
  'MB': 1, // Manitoba
  'NB': 1, // New Brunswick
  'NL': 1, // Newfoundland and Labrador
  'NT': 1, // Northwest Territories
  'NS': 1, // Nova Scotia
  'NU': 1, // Nunavut Territory
  'ON': 1, // Ontario
  'PE': 1, // Prince Edward Island
  'QC': 1, // Quebec
  'SK': 1, // Saskatchewan
  'YT': 1, // Yukon Territory

  // Canada and Mexico state codes
  'CN': 1, // Canada
  'MX': 1, // Mexico
}
const _validate_state_codes = (sz_value) => 1 === valid_state_codes[sz_value]


//***********************************************
//* BEGIN TRANSPILED SECTION ********************
//***********************************************

//*********************************************
// Section: Transaction Identification
//

export const field_1 = {len: 1, pos_start: 0, pos_end: 1,
    idx: 1, name: null, 
    validate: _validate_expect,
    expect: "5", non_content: true,
    note: [
        "5, will always be “5” (for 2024–25)"
    ]};

export const field_2 = {len: 36, pos_start: 1, pos_end: 37,
    idx: 2, name: "FAFSA UUID", path: ["FAFSA_UUID"], 
    validate: _validate_options,
    options: [
      {op: "uuid", },
    ],
    note: [
        "Alphanumeric"
    ]};

export const field_3 = {len: 36, pos_start: 37, pos_end: 73,
    idx: 3, name: "Transaction UUID", path: ["UUID"], 
    validate: _validate_options,
    options: [
      {op: "uuid", },
    ],
    note: [
        "Alphanumeric"
    ]};

export const field_4 = {len: 36, pos_start: 73, pos_end: 109,
    idx: 4, name: "Person UUID", path: ["Person_UUID"], 
    validate: _validate_options,
    options: [
      {op: "uuid", },
    ],
    note: [
        "Alphanumeric"
    ]};

export const field_5 = {len: 2, pos_start: 109, pos_end: 111,
    idx: 5, name: "Transaction Number", path: ["Number"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"01","max":"99"},
    ],
    note: [
        "01 to 99"
    ]};

export const field_6 = {len: 1, pos_start: 111, pos_end: 112,
    idx: 6, name: "Dependency Model", path: ["Dependency_Model"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "D": "Dependent",
        "I": "Independent",
        "Z": "Provisional Independent",
        "X": "Rejected Dependent",
        "Y": "Rejected Independent",
      }},
    ],
    note: [
        "D = Dependent",
        "I = Independent",
        "Z = Provisional Independent",
        "X = Rejected Dependent",
        "Y = Rejected Independent"
    ]};

export const field_7 = {len: 1, pos_start: 112, pos_end: 113,
    idx: 7, name: "Application Source", path: ["Application_Source"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Electronic Data Exchange",
        "2": "Online FAFSA",
        "3": "FAFSA Partner Portal",
        "4": "Paper",
        "5": "FPS",
        "6": "FSAIC",
      }},
    ],
    note: [
        "1 = Electronic Data Exchange",
        "2 = Online FAFSA",
        "3 = FAFSA Partner Portal",
        "4 = Paper",
        "5 = FPS",
        "6 = FSAIC"
    ]};

export const field_8 = {len: 8, pos_start: 113, pos_end: 121,
    idx: 8, name: "Application Receipt Date", path: ["Application_Receipt_Date"], 
    validate: _validate_date,
    "allow_blank":true,"options":[{"op":"range","min":"20231001","max":"20250630"}],
    note: [
        "Format is CCYYMMDD",
        "20231001 to 20250630",
        "Blank"
    ]};

export const field_9 = {len: 1, pos_start: 121, pos_end: 122,
    idx: 9, name: "Transaction Source", path: ["Source"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Electronic Data Exchange",
        "2": "Online FAFSA",
        "3": "FAFSA Partner Portal",
        "4": "Paper",
        "5": "FPS",
        "6": "FSAIC",
      }},
    ],
    note: [
        "1 = Electronic Data Exchange",
        "2 = Online FAFSA",
        "3 = FAFSA Partner Portal",
        "4 = Paper",
        "5 = FPS",
        "6 = FSAIC"
    ]};

export const field_10 = {len: 1, pos_start: 122, pos_end: 123,
    idx: 10, name: "Transaction Type", path: ["Type"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "A": "Application",
        "C": "Correction",
      }},
    ],
    note: [
        "A = Application",
        "C = Correction"
    ]};

export const field_11 = {len: 1, pos_start: 123, pos_end: 124,
    idx: 11, name: "Transaction Language", path: ["Language"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "E": "English",
        "S": "Spanish",
      }},
    ],
    note: [
        "E = English",
        "S = Spanish"
    ]};

export const field_12 = {len: 8, pos_start: 124, pos_end: 132,
    idx: 12, name: "Transaction Receipt Date", path: ["Receipt_Date"], 
    validate: _validate_date,
    "options":[{"op":"range","min":"20231231","max":"20250930"}],
    note: [
        "Format is CCYYMMDD",
        "20231231 to 20250930"
    ]};

export const field_13 = {len: 8, pos_start: 132, pos_end: 140,
    idx: 13, name: "Transaction Process Date", path: ["Process_Date"], 
    validate: _validate_date,
    "options":[{"op":"range","min":"20231231","max":"20250930"}],
    note: [
        "Format is CCYYMMDD",
        "20231231 to 20250930"
    ]};

export const field_14 = {len: 30, pos_start: 140, pos_end: 170,
    idx: 14, name: "Transaction Status", path: ["Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Processed": "Processed",
        "Processed with Action Required": "Processed with Action Required",
      }},
    ],
    note: [
        "Processed",
        "Processed with Action Required"
    ]};

export const field_15 = {len: 3, pos_start: 170, pos_end: 173,
    idx: 15, name: "Renewal Data Used", path: ["Renewal_Data_Used"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Yes": "Yes",
      }},
    ],
    note: [
        "Yes",
        "Blank"
    ]};

export const field_16 = {len: 1, pos_start: 173, pos_end: 174,
    idx: 16, name: "FPS Correction Reason", path: ["FPS_Correction_Reason"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "C": "COD FWS Update",
        "D": "Drug Abuse Hold Release Expired Date",
        "F": "Drug Abuse Hold Release FSA",
        "L": "Identity Hold Release",
        "M": "DHS Secondary Results Processing",
        "N": "NSLDS Postscreening",
        "P": "Reprocessing",
        "W": "NTIS Death File Match",
        "Y": "Identity Verification",
      }},
    ],
    note: [
        "C = COD FWS Update",
        "D = Drug Abuse Hold Release Expired Date",
        "F = Drug Abuse Hold Release FSA",
        "L = Identity Hold Release",
        "M = DHS Secondary Results Processing",
        "N = NSLDS Postscreening",
        "P = Reprocessing",
        "W = NTIS Death File Match",
        "Y = Identity Verification",
        "Blank"
    ]};

export const field_17 = {len: 1, pos_start: 174, pos_end: 175,
    idx: 17, name: "SAI Change Flag", path: ["SAI_Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "SAI Increased",
        "2": "SAI Decreased",
      }},
    ],
    note: [
        "1 = SAI Increased",
        "2 = SAI Decreased",
        "Blank"
    ]};

export const field_18 = {len: 6, pos_start: 175, pos_end: 181,
    idx: 18, name: "SAI", path: ["SAI"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-1500","max":"999999"},
    ],
    note: [
        "-1500 to 999999",
        "Blank"
    ]};

export const field_19 = {len: 6, pos_start: 181, pos_end: 187,
    idx: 19, name: "Provisional SAI", path: ["Provisional_SAI"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-1500","max":"999999"},
    ],
    note: [
        "-1500 to 999999",
        "Blank"
    ]};

export const field_20 = {len: 1, pos_start: 187, pos_end: 188,
    idx: 20, name: "SAI Formula", path: ["SAI_Formula"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "A": "Dependent",
        "B": "Independent without dependents",
        "C": "Independent with dependents",
      }},
    ],
    note: [
        "A = Dependent",
        "B = Independent without dependents",
        "C = Independent with dependents",
        "Blank"
    ]};

export const field_21 = {len: 2, pos_start: 188, pos_end: 190,
    idx: 21, name: "SAI Computation Type", path: ["SAI_Computation_Type"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Dep. Max Pell = 1 and Unmarried",
        "2": "Dep. Max Pell = 1 and Married",
        "3": "Dep. Max Pell = 2 and AGI >0 and <= 225% poverty line",
        "4": "Dep. Max Pell = 3 and AGI >0 and <= 175% poverty line",
        "5": "Indep. Max Pell = 1 and Unmarried",
        "6": "Indep. Max Pell = 1 and Married",
        "7": "Indep. Max Pell = 2 and AGI >0 and <= 225% poverty line",
        "8": "Indep. Max Pell = 3 and AGI >0 and <= 175% poverty line",
        "9 to 13": "For Federal Student Aid use only",
      }},
    ],
    note: [
        "1 = Dep. Max Pell = 1 and Unmarried",
        "2 = Dep. Max Pell = 1 and Married",
        "3 = Dep. Max Pell = 2 and AGI >0 and <= 225% poverty line",
        "4 = Dep. Max Pell = 3 and AGI >0 and <= 175% poverty line",
        "5 = Indep. Max Pell = 1 and Unmarried",
        "6 = Indep. Max Pell = 1 and Married",
        "7 = Indep. Max Pell = 2 and AGI >0 and <= 225% poverty line",
        "8 = Indep. Max Pell = 3 and AGI >0 and <= 175% poverty line",
        "9 to 13 = For Federal Student Aid use only",
        "Blank"
    ]};

export const field_22 = {len: 1, pos_start: 190, pos_end: 191,
    idx: 22, name: "Max Pell Indicator", path: ["Max_Pell_Indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Nonfiler",
        "2": "Single parent and AGI <= 225% poverty line",
        "3": "Not a single parent and AGI <= 175% poverty line",
      }},
    ],
    note: [
        "1 = Nonfiler",
        "2 = Single parent and AGI <= 225% poverty line",
        "3 = Not a single parent and AGI <= 175% poverty line",
        "Blank"
    ]};

export const field_23 = {len: 1, pos_start: 191, pos_end: 192,
    idx: 23, name: "Minimum Pell Indicator", path: ["Minimum_Pell_Indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Dep. Single parent and AGI <= 325% poverty line",
        "2": "Dep. Not a single Parent and AGI <=275% poverty line",
        "3": "Indep. Single parent and AGI <=400% poverty line",
        "4": "Indep. Not a single parent and <=350% poverty line",
        "5": "Indep. Not a parent and <=275% of poverty line",
      }},
    ],
    note: [
        "1 = Dep. Single parent and AGI <= 325% poverty line",
        "2 = Dep. Not a single Parent and AGI <=275% poverty line",
        "3 = Indep. Single parent and AGI <=400% poverty line",
        "4 = Indep. Not a single parent and <=350% poverty line",
        "5 = Indep. Not a parent and <=275% of poverty line",
        "Blank"
    ]};

export const field_24 = {len: 50, pos_start: 192, pos_end: 242,
    idx: 24, name: null, 
    extra: "Filler: Student Information",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};


export const section_transaction = /* #__PURE__ */ {
    section: "Transaction Identification",
    path: ["transaction"],
    field_list: [field_1, field_2, field_3, field_4, field_5, field_6, field_7, field_8, field_9, field_10, field_11, field_12, field_13, field_14, field_15, field_16, field_17, field_18, field_19, field_20, field_21, field_22, field_23, field_24],
}


//*********************************************
// Section: Student Demographic, Identity, and Contact Information
//

export const field_25 = {len: 35, pos_start: 242, pos_end: 277,
    idx: 25, name: "First Name", path: ["First_Name"], fafsa_category: "Student Identity \n1a", non_content: true, 
    note: [
        "First character must contain a letter and second character must be non-numeric",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)",
        "Blank"
    ]};

export const field_26 = {len: 15, pos_start: 277, pos_end: 292,
    idx: 26, name: "Middle Name", path: ["Middle_Name"], fafsa_category: "1b", non_content: true, 
    note: [
        "First character must contain a letter",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)",
        "Blank"
    ]};

export const field_27 = {len: 35, pos_start: 292, pos_end: 327,
    idx: 27, name: "Last Name", path: ["Last_Name"], fafsa_category: "1c", non_content: true, 
    note: [
        "First character must contain a letter and second character must be non-numeric",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)"
    ]};

export const field_28 = {len: 10, pos_start: 327, pos_end: 337,
    idx: 28, name: "Suffix", path: ["Suffix"], fafsa_category: "1d", non_content: true, 
    note: [
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)",
        "Blank"
    ]};

export const field_29 = {len: 8, pos_start: 337, pos_end: 345,
    idx: 29, name: "Date of Birth", path: ["Date_of_Birth"], fafsa_category: "1e", 
    validate: _validate_date,
    "options":[{"op":"range","min":"19000101","max":"20251231"}],
    note: [
        "19000101 to current date",
        "Numeric within valid range.",
        "Format is CCYYMMDD where MM is 01-12, (CC is 19 and YY is 00 to 99) or (CC is 20 and YY is 00-24). Valid day range depending on month (see table below).",
        "Month Valid Day Range",
        " 01\t01-31",
        " 02\t01 to 28 (unless year is divisible by 4 for non-centurial years or 400 for centurial years, then 01 to 29 is valid)",
        " 03\t01-31",
        " 04\t01-30",
        " 05\t01-31",
        " 06\t01-30",
        " 07\t01-31",
        " 08\t01-31",
        " 09\t01-30",
        " 10\t01-31",
        " 11\t01-30",
        " 12\t01-31"
    ]};

export const field_30 = {len: 9, pos_start: 345, pos_end: 354,
    idx: 30, name: "Social Security Number", path: ["Social_Security_Number"], fafsa_category: "1f", 
    extra: ["Pseudo SSNs created in a cycle prior to 2024–25 will begin with 666","Pseudo SSNs created in the 2024–25 cycle will begin with 000"],
    validate: _validate_options,
    options: [
      {op: "range", "min":"000010001","max":"999999999"},
    ],
    note: [
        "000010001 to 999999999"
    ]};

export const field_31 = {len: 9, pos_start: 354, pos_end: 363,
    idx: 31, name: "ITIN", path: ["ITIN"], fafsa_category: "1g", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"900000000","max":"999999999"},
    ],
    note: [
        "900000000 to 999999999",
        "Blank"
    ]};

export const field_32 = {len: 10, pos_start: 363, pos_end: 373,
    idx: 32, name: "Phone Number", path: ["Phone_Number"], fafsa_category: "Student Contact Information\n2a", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0000000000","max":"9999999999"},
    ],
    note: [
        "0000000000 to 9999999999",
        "Blank"
    ]};

export const field_33 = {len: 50, pos_start: 373, pos_end: 423,
    idx: 33, name: "Email Address", path: ["Email_Address"], fafsa_category: "2b", 
    validate: _validate_options,
    options: [
      {op: "email", },
    ],
    note: [
        "1. One and only one at-sign '@' allowed.",
        "2. Before the at-sign:",
        "-at least one valid character",
        "-all characters in the range of ASCII 33 – 126, except for the following thirteen characters: < > ( ) [ ] \\ , ; : \" @ ^",
        "-period cannot be first, last or adjacent to another period.",
        "3. After the at-sign:",
        "-at least one valid character",
        "-only letters, digits, hyphen, underscore and period (A to Z, A to Z, 0 to 9, -, _, .)",
        "-Hyphen, underscore and period cannot be first, last, or adjacent to a period",
        "Blank"
    ]};

export const field_34 = {len: 40, pos_start: 423, pos_end: 463,
    idx: 34, name: "Street Address", path: ["Street_Address"], fafsa_category: "2c", non_content: true, 
    note: [
        "If non-blank, first character must be non-blank.",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        "# (number)",
        "@ (at)",
        "& (ampersand)",
        "/ (slash)",
        ", (comma)",
        " (spaces)",
        "Blank"
    ]};

export const field_35 = {len: 30, pos_start: 463, pos_end: 493,
    idx: 35, name: "City", path: ["City"], fafsa_category: "2d", non_content: true, 
    note: [
        "If non-blank, first character must be non-blank.",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        "/ (slash)",
        ", (comma)",
        " (spaces)",
        "Blank"
    ]};

export const field_36 = {len: 2, pos_start: 493, pos_end: 495,
    idx: 36, name: "State", path: ["State"], fafsa_category: "2e", 
    validate: _validate_state_codes,
    note: [
        "Valid two letter code (See State Codes)",
        "Blank"
    ]};

export const field_37 = {len: 10, pos_start: 495, pos_end: 505,
    idx: 37, name: "Zip Code", path: ["Zip_Code"], fafsa_category: "2f", 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        "- (dash)",
        " (space)",
        "Blank"
    ]};

export const field_38 = {len: 2, pos_start: 505, pos_end: 507,
    idx: 38, name: "Country", path: ["Country"], fafsa_category: "2g", 
    validate: _validate_country_codes,
    note: [
        "Valid two letter code (See Country Codes)",
        "Blank"
    ]};

export const field_39 = {len: 50, pos_start: 507, pos_end: 557,
    idx: 39, name: null, 
    extra: "Filler: Student Demographic",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};


export const section_student_identity = /* #__PURE__ */ {
    section: "Student Demographic, Identity, and Contact Information",
    path: ["student","identity"],
    field_list: [field_25, field_26, field_27, field_28, field_29, field_30, field_31, field_32, field_33, field_34, field_35, field_36, field_37, field_38, field_39],
}


//*********************************************
// Section: Student Non-Financial Information
//

export const field_40 = {len: 1, pos_start: 557, pos_end: 558,
    idx: 40, name: "Marital Status", path: ["Marital_Status"], fafsa_category: "Student Marital Status\n3", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Single (Never married)",
        "2": "Married (not separated)",
        "3": "Remarried",
        "4": "Divorced",
        "5": "Separated",
        "6": "Widowed",
      }},
    ],
    note: [
        "1 = Single (Never married)",
        "2 = Married (not separated)",
        "3 = Remarried",
        "4 = Divorced",
        "5 = Separated",
        "6 = Widowed",
        "Blank"
    ]};

export const field_41 = {len: 1, pos_start: 558, pos_end: 559,
    idx: 41, name: "Grade Level in College 2024-25", path: ["Grade_Level_in_College"], fafsa_category: "Student College or Career School Plans\n4a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "First Year (Freshman)",
        "2": "Second Year (Sophomore)",
        "3": "Other Undergraduate (Junior or Senior)",
        "4": "College Graduate, Professional or Beyond (MBA, M.D., Ph.D., etc.)",
      }},
    ],
    note: [
        "1 = First Year (Freshman)",
        "2 = Second Year (Sophomore)",
        "3 = Other Undergraduate (Junior or Senior)",
        "4 = College Graduate, Professional or Beyond (MBA, M.D., Ph.D., etc.)",
        "Blank"
    ]};

export const field_42 = {len: 1, pos_start: 559, pos_end: 560,
    idx: 42, name: "First Bachelor's Degree Before 2024-25 School Year", path: ["First_Bachelors_Degree_Before_School_Year"], fafsa_category: "4b", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_43 = {len: 1, pos_start: 560, pos_end: 561,
    idx: 43, name: "Pursuing Teacher Certification?", path: ["Pursuing_Teacher_Certification"], fafsa_category: "4c", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_44 = {len: 1, pos_start: 561, pos_end: 562,
    idx: 44, name: "Active Duty?", path: ["Active_Duty"], fafsa_category: "Student Personal Circumstances\n5a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_45 = {len: 1, pos_start: 562, pos_end: 563,
    idx: 45, name: "Veteran?", path: ["Veteran"], fafsa_category: "5b", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_46 = {len: 1, pos_start: 563, pos_end: 564,
    idx: 46, name: "Child or Other Dependents?", path: ["Child_or_Other_Dependents"], fafsa_category: "5c", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_47 = {len: 1, pos_start: 564, pos_end: 565,
    idx: 47, name: "Parents Deceased?", path: ["Parents_Deceased"], fafsa_category: "5d", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_48 = {len: 1, pos_start: 565, pos_end: 566,
    idx: 48, name: "Ward of Court?", path: ["Ward_of_Court"], fafsa_category: "5e", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_49 = {len: 1, pos_start: 566, pos_end: 567,
    idx: 49, name: "In Foster Care?", path: ["In_Foster_Care"], fafsa_category: "5f", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_50 = {len: 1, pos_start: 567, pos_end: 568,
    idx: 50, name: "Emancipated Minor?", path: ["Emancipated_Minor"], fafsa_category: "5g", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_51 = {len: 1, pos_start: 568, pos_end: 569,
    idx: 51, name: "Legal Guardianship?", path: ["Legal_Guardianship"], fafsa_category: "5h", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_52 = {len: 1, pos_start: 569, pos_end: 570,
    idx: 52, name: "Personal Circumstances: None of the above", path: ["Personal_Circumstances_None_of_the_above"], fafsa_category: "5i", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_53 = {len: 1, pos_start: 570, pos_end: 571,
    idx: 53, name: "Unaccompanied Homeless Youth, or is Unaccompanied, At Risk of Homelessness, and Self-Supporting?", path: ["Unaccompanied_Homeless_Youth_or_is_Unaccompanied_At_Risk_of_Homelessness_and_Self_Supporting"], fafsa_category: "Student Other Circumstances\n6a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_54 = {len: 1, pos_start: 571, pos_end: 572,
    idx: 54, name: "Unaccompanied and Homeless (General)?", path: ["Unaccompanied_and_Homeless_General"], fafsa_category: "6b", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_55 = {len: 1, pos_start: 572, pos_end: 573,
    idx: 55, name: "Unaccompanied and Homeless (HS)?", path: ["Unaccompanied_and_Homeless_HS"], fafsa_category: "6c", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_56 = {len: 1, pos_start: 573, pos_end: 574,
    idx: 56, name: "Unaccompanied and Homeless (TRIO)?", path: ["Unaccompanied_and_Homeless_TRIO"], fafsa_category: "6d", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_57 = {len: 1, pos_start: 574, pos_end: 575,
    idx: 57, name: "Unaccompanied and Homeless (FAA)?", path: ["Unaccompanied_and_Homeless_FAA"], fafsa_category: "6e", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_58 = {len: 1, pos_start: 575, pos_end: 576,
    idx: 58, name: "Other Circumstances: None of the Above", path: ["Other_Circumstances_None_of_the_Above"], fafsa_category: "6f", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_59 = {len: 1, pos_start: 576, pos_end: 577,
    idx: 59, name: "Unusual Circumstance?", path: ["Unusual_Circumstance"], fafsa_category: "Student Unusual Circumstances\n7", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_60 = {len: 1, pos_start: 577, pos_end: 578,
    idx: 60, name: "Unsub Only", path: ["Unsub_Only"], fafsa_category: "Apply for a Direct Unsubsidized Loan Only\n8", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_61 = {len: 2, pos_start: 578, pos_end: 580,
    idx: 61, name: "Updated Family Size", path: ["Updated_Family_Size"], fafsa_category: "Family Size \n9", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99"},
    ],
    note: [
        "0 to 99",
        "Blank"
    ]};

export const field_62 = {len: 2, pos_start: 580, pos_end: 582,
    idx: 62, name: "Number in College", path: ["Number_in_College"], fafsa_category: "Number in College\n10", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99"},
    ],
    note: [
        "0 to 99",
        "Blank"
    ]};


export const section_student_non_financial = /* #__PURE__ */ {
    section: "Student Non-Financial Information",
    path: ["student","non_financial"],
    field_list: [field_40, field_41, field_42, field_43, field_44, field_45, field_46, field_47, field_48, field_49, field_50, field_51, field_52, field_53, field_54, field_55, field_56, field_57, field_58, field_59, field_60, field_61, field_62],
}


//*********************************************
// Section: Student Demographic Information
//

export const field_63 = {len: 1, pos_start: 582, pos_end: 583,
    idx: 63, name: "Citizenship Status", path: ["Citizenship_Status"], fafsa_category: "Student Citizenship Status\n13a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "U.S. Citizen",
        "2": "Eligible Non-citizen",
        "3": "Neither Citizen nor Eligible Non-citizen",
      }},
    ],
    note: [
        "1 = U.S. Citizen",
        "2 = Eligible Non-citizen",
        "3 = Neither Citizen nor Eligible Non-citizen",
        "Blank"
    ]};

export const field_64 = {len: 9, pos_start: 583, pos_end: 592,
    idx: 64, name: "A-Number", path: ["A_Number"], fafsa_category: "13b", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000001","max":"999999999"},
    ],
    note: [
        "000000001 to 999999999",
        "Blank"
    ]};

export const field_65 = {len: 2, pos_start: 592, pos_end: 594,
    idx: 65, name: "State of Legal Residence", path: ["State_of_Legal_Residence"], fafsa_category: "Student State of Legal Residence \n14a", 
    validate: _validate_state_codes,
    note: [
        "Valid two letter code (See State Codes)",
        "Blank"
    ]};

export const field_66 = {len: 6, pos_start: 594, pos_end: 600,
    idx: 66, name: "Legal Residence Date", path: ["Legal_Residence_Date"], fafsa_category: "14b", 
    validate: _validate_yearmonth,
    "allow_blank":true,"options":[{"op":"range","min":"190001","max":"20251231"}],
    note: [
        "Numeric within valid date range; 190001 to current date",
        "Format is CCYYMM",
        "Blank"
    ]};

export const field_67 = {len: 1, pos_start: 600, pos_end: 601,
    idx: 67, name: "Either Parent Attend College", path: ["Either_Parent_Attend_College"], fafsa_category: "Parent Education Status\n15", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Neither parent attended college",
        "2": "One or both parents attended college, but neither parent completed college",
        "3": "One or both parents completed college",
        "4": "Don’t know",
      }},
    ],
    note: [
        "1 = Neither parent attended college",
        "2 = One or both parents attended college, but neither parent completed college",
        "3 = One or both parents completed college",
        "4 = Don’t know",
        "Blank"
    ]};

export const field_68 = {len: 1, pos_start: 601, pos_end: 602,
    idx: 68, name: "Parent Killed in the Line of Duty", path: ["Parent_Killed_in_the_Line_of_Duty"], fafsa_category: "Parent Killed in Line of Duty \n16", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_69 = {len: 1, pos_start: 602, pos_end: 603,
    idx: 69, name: "High School Completion Status", path: ["High_School_Completion_Status"], fafsa_category: "Student High School Information\n17a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "High school diploma",
        "2": "State recognized high school equivalent (e.g. GED)",
        "3": "Homeschooled",
        "4": "None of the Above",
      }},
    ],
    note: [
        "1 = High school diploma",
        "2 = State recognized high school equivalent (e.g. GED)",
        "3 = Homeschooled",
        "4 = None of the Above",
        "Blank"
    ]};

export const field_70 = {len: 60, pos_start: 603, pos_end: 663,
    idx: 70, name: "High School Name", path: ["High_School_Name"], fafsa_category: "17b", non_content: true, 
    note: [
        "Alphanumeric; 0 to 9, uppercase and lowercase A to Z",
        " . (period)",
        "- (dash)",
        "' (apostrophe)",
        "# (number)",
        "@ (at)",
        "% (percent or care of)",
        "& (ampersand)",
        "/ (slash)",
        ", (comma)",
        ": (colon)",
        "“” (quotation marks; must be used in pairs)",
        "( ) (parenthesis)",
        "+ (plus)",
        "! (exclamation point)",
        "Blank"
    ]};

export const field_71 = {len: 28, pos_start: 663, pos_end: 691,
    idx: 71, name: "High School City", path: ["High_School_City"], fafsa_category: "17c", non_content: true, 
    note: [
        "If non-blank, first character must be non-blank.",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        "% (percent or care of)",
        "& (ampersand)",
        "/ (slash)",
        ", (comma)",
        "Blank"
    ]};

export const field_72 = {len: 2, pos_start: 691, pos_end: 693,
    idx: 72, name: "High School State", path: ["High_School_State"], fafsa_category: "17d", 
    validate: _validate_state_codes,
    note: [
        "Valid two letter code (See State Codes)",
        "Blank"
    ]};

export const field_73 = {len: 1, pos_start: 693, pos_end: 694,
    idx: 73, name: "High School Equivalent Diploma Name", path: ["High_School_Equivalent_Diploma_Name"], fafsa_category: "17e", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "General Education Development (GED)",
        "2": "High School Equivalency Test (HiSET)",
        "3": "Test Assessing Secondary Completion (TASC)",
        "4": "Other",
      }},
    ],
    note: [
        "1 = General Education Development (GED)",
        "2 = High School Equivalency Test (HiSET)",
        "3 = Test Assessing Secondary Completion (TASC)",
        "4 = Other",
        "Blank"
    ]};

export const field_74 = {len: 2, pos_start: 694, pos_end: 696,
    idx: 74, name: "High School Equivalent Diploma State", path: ["High_School_Equivalent_Diploma_State"], fafsa_category: "17f", 
    validate: _validate_state_codes,
    note: [
        "Valid two letter code (See State Codes)",
        "Blank"
    ]};


export const section_student_demographic = /* #__PURE__ */ {
    section: "Student Demographic Information",
    path: ["student","demographic"],
    field_list: [field_63, field_64, field_65, field_66, field_67, field_68, field_69, field_70, field_71, field_72, field_73, field_74],
}


//*********************************************
// Section: Student Manually Entered Financial
//

export const field_75 = {len: 1, pos_start: 696, pos_end: 697,
    idx: 75, name: "Received EITC", path: ["Received_EITC"], fafsa_category: "Federal Benefits Received\n18a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_76 = {len: 1, pos_start: 697, pos_end: 698,
    idx: 76, name: "Received Federal Housing Assistance", path: ["Received_Federal_Housing_Assistance"], fafsa_category: "18b", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_77 = {len: 1, pos_start: 698, pos_end: 699,
    idx: 77, name: "Received Free/Reduced Price Lunch", path: ["Received_FreeReduced_Price_Lunch"], fafsa_category: "18c", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_78 = {len: 1, pos_start: 699, pos_end: 700,
    idx: 78, name: "Received Medicaid", path: ["Received_Medicaid"], fafsa_category: "18d", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_79 = {len: 1, pos_start: 700, pos_end: 701,
    idx: 79, name: "Received Refundable Credit for 36B Health Plan", path: ["Received_Refundable_Credit_for_36B_Health_Plan"], fafsa_category: "18e", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_80 = {len: 1, pos_start: 701, pos_end: 702,
    idx: 80, name: "Received SNAP", path: ["Received_SNAP"], fafsa_category: "18f", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_81 = {len: 1, pos_start: 702, pos_end: 703,
    idx: 81, name: "Received Supplemental Security Income", path: ["Received_Supplemental_Security_Income"], fafsa_category: "18g", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_82 = {len: 1, pos_start: 703, pos_end: 704,
    idx: 82, name: "Received TANF", path: ["Received_TANF"], fafsa_category: "18h", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_83 = {len: 1, pos_start: 704, pos_end: 705,
    idx: 83, name: "Received WIC", path: ["Received_WIC"], fafsa_category: "18i", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_84 = {len: 1, pos_start: 705, pos_end: 706,
    idx: 84, name: "Federal Benefits: None of the Above", path: ["Federal_Benefits_None_of_the_Above"], fafsa_category: "18j", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_85 = {len: 1, pos_start: 706, pos_end: 707,
    idx: 85, name: "Filed 1040 or 1040NR", path: ["Filed_1040_or_1040NR"], fafsa_category: "Student Tax Filing Status\n19a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_86 = {len: 1, pos_start: 707, pos_end: 708,
    idx: 86, name: "Filed Non-U.S. Tax Return", path: ["Filed_Non_US_Tax_Return"], fafsa_category: "19b", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_87 = {len: 1, pos_start: 708, pos_end: 709,
    idx: 87, name: "Filed Joint Return With Current Spouse", path: ["Filed_Joint_Return_With_Current_Spouse"], fafsa_category: "19c", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_88 = {len: 1, pos_start: 709, pos_end: 710,
    idx: 88, name: "Tax Return Filing Status", path: ["Tax_Return_Filing_Status"], fafsa_category: "Student 20xx Tax Return Information\n20a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Single",
        "2": "Married-Filed Joint Return",
        "3": "Married-Filed Separate Return",
        "4": "Head of Household",
        "5": "Qualifying Surviving Spouse",
      }},
    ],
    note: [
        "1 = Single",
        "2 = Married-Filed Joint Return",
        "3 = Married-Filed Separate Return",
        "4 = Head of Household",
        "5 = Qualifying Surviving Spouse",
        "Blank"
    ]};

export const field_89 = {len: 11, pos_start: 710, pos_end: 721,
    idx: 89, name: "Income Earned from Work", path: ["Income_Earned_from_Work"], fafsa_category: "20b", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_90 = {len: 11, pos_start: 721, pos_end: 732,
    idx: 90, name: "Tax Exempt Interest Income", path: ["Tax_Exempt_Interest_Income"], fafsa_category: "20c", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_91 = {len: 11, pos_start: 732, pos_end: 743,
    idx: 91, name: "Untaxed Portions of IRA Distributions", path: ["Untaxed_Portions_of_IRA_Distributions"], fafsa_category: "20d", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_92 = {len: 11, pos_start: 743, pos_end: 754,
    idx: 92, name: "IRA Rollover", path: ["IRA_Rollover"], fafsa_category: "20e", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_93 = {len: 11, pos_start: 754, pos_end: 765,
    idx: 93, name: "Untaxed Portions of Pensions", path: ["Untaxed_Portions_of_Pensions"], fafsa_category: "20f", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_94 = {len: 11, pos_start: 765, pos_end: 776,
    idx: 94, name: "Pension Rollover", path: ["Pension_Rollover"], fafsa_category: "20g", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_95 = {len: 10, pos_start: 776, pos_end: 786,
    idx: 95, name: "Adjusted Gross Income", path: ["Adjusted_Gross_Income"], fafsa_category: "20h", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-999999999","max":"999999999"},
    ],
    note: [
        "-999999999 to 999999999",
        "Blank"
    ]};

export const field_96 = {len: 9, pos_start: 786, pos_end: 795,
    idx: 96, name: "Income Tax Paid", path: ["Income_Tax_Paid"], fafsa_category: "20i", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999"},
    ],
    note: [
        "0 to 999999999",
        "Blank"
    ]};

export const field_97 = {len: 1, pos_start: 795, pos_end: 796,
    idx: 97, name: "Earned Income Tax Credit Received During Tax Year?", path: ["Earned_Income_Tax_Credit_Received_During_Tax_Year"], fafsa_category: "20j", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
        "3": "Don't Know",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "3 = Don't Know",
        "Blank"
    ]};

export const field_98 = {len: 11, pos_start: 796, pos_end: 807,
    idx: 98, name: "Deductible Payments to IRA, Keogh, Other", path: ["Deductible_Payments_to_IRA_Keogh_Other"], fafsa_category: "20k", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_99 = {len: 9, pos_start: 807, pos_end: 816,
    idx: 99, name: "Education Credits", path: ["Education_Credits"], fafsa_category: "20l", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999"},
    ],
    note: [
        "0 to 999999999",
        "Blank"
    ]};

export const field_100 = {len: 1, pos_start: 816, pos_end: 817,
    idx: 100, name: "Filed Schedule A, B, D, E, F or H?", path: ["Filed_Schedule_A_B_D_E_F_or_H"], fafsa_category: "20m", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
        "3": "Don't Know",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "3 = Don't Know",
        "Blank"
    ]};

export const field_101 = {len: 12, pos_start: 817, pos_end: 829,
    idx: 101, name: "Schedule C Amount", path: ["Schedule_C_Amount"], fafsa_category: "20n", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-99999999999","max":"99999999999"},
    ],
    note: [
        "-99999999999 to 99999999999",
        "Blank"
    ]};

export const field_102 = {len: 7, pos_start: 829, pos_end: 836,
    idx: 102, name: "College Grant and Scholarship Aid", path: ["College_Grant_and_Scholarship_Aid"], fafsa_category: "20o", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"9999999"},
    ],
    note: [
        "0 to 9999999",
        "Blank"
    ]};

export const field_103 = {len: 10, pos_start: 836, pos_end: 846,
    idx: 103, name: "Foreign Earned Income Exclusion", path: ["Foreign_Earned_Income_Exclusion"], fafsa_category: "20p", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-999999999","max":"999999999"},
    ],
    note: [
        "-999999999 to 999999999",
        "Blank"
    ]};

export const field_104 = {len: 7, pos_start: 846, pos_end: 853,
    idx: 104, name: "Child Support Received", path: ["Child_Support_Received"], fafsa_category: "Annual Child Support Received \n21", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"9999999"},
    ],
    note: [
        "0 to 9999999",
        "Blank"
    ]};

export const field_105 = {len: 7, pos_start: 853, pos_end: 860,
    idx: 105, name: "Total of Cash, Savings, and Checking Accounts", path: ["Total_of_Cash_Savings_and_Checking_Accounts"], fafsa_category: "Student Assets\n22a", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"9999999"},
    ],
    note: [
        "0 to 9999999",
        "Blank"
    ]};

export const field_106 = {len: 7, pos_start: 860, pos_end: 867,
    idx: 106, name: "Net Worth of Current Investments", path: ["Net_Worth_of_Current_Investments"], fafsa_category: "22b", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"9999999"},
    ],
    note: [
        "0 to 9999999",
        "Blank"
    ]};

export const field_107 = {len: 7, pos_start: 867, pos_end: 874,
    idx: 107, name: "Net Worth of Businesses and Investment Farms", path: ["Net_Worth_of_Businesses_and_Investment_Farms"], fafsa_category: "22c", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"9999999"},
    ],
    note: [
        "0 to 9999999",
        "Blank"
    ]};


export const section_student_financial_manual = /* #__PURE__ */ {
    section: "Student Manually Entered Financial",
    path: ["student","financial_manual"],
    field_list: [field_75, field_76, field_77, field_78, field_79, field_80, field_81, field_82, field_83, field_84, field_85, field_86, field_87, field_88, field_89, field_90, field_91, field_92, field_93, field_94, field_95, field_96, field_97, field_98, field_99, field_100, field_101, field_102, field_103, field_104, field_105, field_106, field_107],
}


//*********************************************
// Section: Student School Choices
//

export const field_108 = {len: 6, pos_start: 874, pos_end: 880,
    idx: 108, name: "College #1", path: ["College_1"], fafsa_category: "Colleges\n23a", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_109 = {len: 6, pos_start: 880, pos_end: 886,
    idx: 109, name: "College #2", path: ["College_2"], fafsa_category: "23b", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_110 = {len: 6, pos_start: 886, pos_end: 892,
    idx: 110, name: "College #3", path: ["College_3"], fafsa_category: "23c", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_111 = {len: 6, pos_start: 892, pos_end: 898,
    idx: 111, name: "College #4", path: ["College_4"], fafsa_category: "23d", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "/0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_112 = {len: 6, pos_start: 898, pos_end: 904,
    idx: 112, name: "College #5", path: ["College_5"], fafsa_category: "23e", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_113 = {len: 6, pos_start: 904, pos_end: 910,
    idx: 113, name: "College #6", path: ["College_6"], fafsa_category: "23f", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_114 = {len: 6, pos_start: 910, pos_end: 916,
    idx: 114, name: "College #7", path: ["College_7"], fafsa_category: "23g", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_115 = {len: 6, pos_start: 916, pos_end: 922,
    idx: 115, name: "College #8", path: ["College_8"], fafsa_category: "23h", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_116 = {len: 6, pos_start: 922, pos_end: 928,
    idx: 116, name: "College #9", path: ["College_9"], fafsa_category: "23i", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_117 = {len: 6, pos_start: 928, pos_end: 934,
    idx: 117, name: "College #10", path: ["College_10"], fafsa_category: "23j", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_118 = {len: 6, pos_start: 934, pos_end: 940,
    idx: 118, name: "College #11", path: ["College_11"], fafsa_category: "23k", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_119 = {len: 6, pos_start: 940, pos_end: 946,
    idx: 119, name: "College #12", path: ["College_12"], fafsa_category: "23l", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_120 = {len: 6, pos_start: 946, pos_end: 952,
    idx: 120, name: "College #13", path: ["College_13"], fafsa_category: "23m", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_121 = {len: 6, pos_start: 952, pos_end: 958,
    idx: 121, name: "College #14", path: ["College_14"], fafsa_category: "23n", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_122 = {len: 6, pos_start: 958, pos_end: 964,
    idx: 122, name: "College #15", path: ["College_15"], fafsa_category: "23o", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_123 = {len: 6, pos_start: 964, pos_end: 970,
    idx: 123, name: "College #16", path: ["College_16"], fafsa_category: "23p", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_124 = {len: 6, pos_start: 970, pos_end: 976,
    idx: 124, name: "College #17", path: ["College_17"], fafsa_category: "23q", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_125 = {len: 6, pos_start: 976, pos_end: 982,
    idx: 125, name: "College #18", path: ["College_18"], fafsa_category: "23r", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_126 = {len: 6, pos_start: 982, pos_end: 988,
    idx: 126, name: "College #19", path: ["College_19"], fafsa_category: "23s", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_127 = {len: 6, pos_start: 988, pos_end: 994,
    idx: 127, name: "College #20", path: ["College_20"], fafsa_category: "23t", 
    validate: _validate_school_code,
    note: [
        "000000 to 099999",
        "0, B, E, and G valid for 1st position",
        "Must be a number of a school certified for participation in EDE only",
        "Blank"
    ]};

export const field_128 = {len: 1, pos_start: 994, pos_end: 995,
    idx: 128, name: "Consent to Retrieve and Disclose FTI", path: ["Consent_to_Retrieve_and_Disclose_FTI"], fafsa_category: "Student Consent and Signature\n24a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Granted",
        "2": "Not Granted",
      }},
    ],
    note: [
        "1 = Granted",
        "2 = Not Granted",
        "Blank"
    ]};


export const section_student_schools = /* #__PURE__ */ {
    section: "Student School Choices",
    path: ["student","schools"],
    field_list: [field_108, field_109, field_110, field_111, field_112, field_113, field_114, field_115, field_116, field_117, field_118, field_119, field_120, field_121, field_122, field_123, field_124, field_125, field_126, field_127, field_128],
}


//*********************************************
// Section: Student Consent and Signature
//

export const field_129 = {len: 1, pos_start: 995, pos_end: 996,
    idx: 129, name: "Signature", path: ["Signature"], fafsa_category: "24b", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_130 = {len: 8, pos_start: 996, pos_end: 1004,
    idx: 130, name: "Signature Date", path: ["Signature_Date"], fafsa_category: "24c", 
    validate: _validate_date,
    "allow_blank":true,"options":[{"op":"range","min":"20231231","max":"20250930"}],
    note: [
        "Format is CCYYMMDD",
        "20231231 to 20250930",
        "Blank"
    ]};

export const field_131 = {len: 50, pos_start: 1004, pos_end: 1054,
    idx: 131, name: null, 
    extra: "Filler: Student Financial and School",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};


export const section_student_consent = /* #__PURE__ */ {
    section: "Student Consent and Signature",
    path: ["student","consent"],
    field_list: [field_129, field_130, field_131],
}


//*********************************************
// Section: Student Spouse Demographic, Identity, and Contact Information
//

export const field_132 = {len: 35, pos_start: 1054, pos_end: 1089,
    idx: 132, name: "First Name", path: ["First_Name"], fafsa_category: "Student Spouse Identity Information\n25a", non_content: true, 
    note: [
        "First character must contain a letter and second character must be non-numeric",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)",
        "Blank"
    ]};

export const field_133 = {len: 15, pos_start: 1089, pos_end: 1104,
    idx: 133, name: "Middle Name", path: ["Middle_Name"], fafsa_category: "25b", non_content: true, 
    note: [
        "First character must contain a letter",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)",
        "Blank"
    ]};

export const field_134 = {len: 35, pos_start: 1104, pos_end: 1139,
    idx: 134, name: "Last Name", path: ["Last_Name"], fafsa_category: "25c", non_content: true, 
    note: [
        "First character must contain a letter and second character must be non-numeric",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)",
        "Blank"
    ]};

export const field_135 = {len: 10, pos_start: 1139, pos_end: 1149,
    idx: 135, name: "Suffix", path: ["Suffix"], fafsa_category: "25d", non_content: true, 
    note: [
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)",
        "Blank"
    ]};

export const field_136 = {len: 8, pos_start: 1149, pos_end: 1157,
    idx: 136, name: "Date of Birth", path: ["Date_of_Birth"], fafsa_category: "25e", 
    validate: _validate_date,
    "options":[{"op":"range","min":"19000101","max":"20251231"}],
    note: [
        "19000101 to current date",
        "Numeric within valid range.",
        "Format is CCYYMMDD where MM is 01-12, (CC is 19 and YY is 00 to 99) or (CC is 20 and YY is 00-23). Valid day range depending on month (see table below).",
        "Month Valid Day Range",
        " 01\t01-31",
        " 02\t01 to 28 (unless year is divisible by 4 for non-centurial years or 400 for centurial years, then 01 to 29 is valid)",
        " 03\t01-31",
        " 04\t01-30",
        " 05\t01-31",
        " 06\t01-30",
        " 07\t01-31",
        " 08\t01-31",
        " 09\t01-30",
        " 10\t01-31",
        " 11\t01-30",
        " 12\t01-31",
        "Blank"
    ]};

export const field_137 = {len: 9, pos_start: 1157, pos_end: 1166,
    idx: 137, name: "Social Security Number", path: ["Social_Security_Number"], fafsa_category: "25f", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000000","max":"999999999"},
    ],
    note: [
        "000000000 to 999999999",
        "Blank"
    ]};

export const field_138 = {len: 9, pos_start: 1166, pos_end: 1175,
    idx: 138, name: "ITIN", path: ["ITIN"], fafsa_category: "25g", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"900000000","max":"999999999"},
    ],
    note: [
        "900000000 to 999999999",
        "Blank"
    ]};

export const field_139 = {len: 10, pos_start: 1175, pos_end: 1185,
    idx: 139, name: "Phone Number", path: ["Phone_Number"], fafsa_category: "Student Spouse Contact Information\n26a", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0000000000","max":"9999999999"},
    ],
    note: [
        "0000000000 to 9999999999",
        "Blank"
    ]};

export const field_140 = {len: 50, pos_start: 1185, pos_end: 1235,
    idx: 140, name: "Email Address", path: ["Email_Address"], fafsa_category: "26b", 
    validate: _validate_options,
    options: [
      {op: "email", },
    ],
    note: [
        "1. One and only one at-sign '@' allowed.",
        "2. Before the at-sign:",
        "-at least one valid character",
        "-all characters in the range of ASCII 33 – 126, except for the following thirteen characters: < > ( ) [ ] \\ , ; : \" @ ^",
        "-period cannot be first, last or adjacent to another period.",
        "3. After the at-sign:",
        "-at least one valid character",
        "-only letters, digits, hyphen, underscore and period (A to Z, A to Z, 0 to 9, -, _, .)",
        "-Hyphen, underscore and period cannot be first, last, or adjacent to a period",
        "Blank"
    ]};

export const field_141 = {len: 40, pos_start: 1235, pos_end: 1275,
    idx: 141, name: "Street Address", path: ["Street_Address"], fafsa_category: "26c", non_content: true, 
    note: [
        "If non-blank, first character must be non-blank.",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        "# (number)",
        "@ (at)",
        "& (ampersand)",
        "/ (slash)",
        ", (comma)",
        " (spaces)",
        "Blank"
    ]};

export const field_142 = {len: 30, pos_start: 1275, pos_end: 1305,
    idx: 142, name: "City", path: ["City"], fafsa_category: "26d", non_content: true, 
    note: [
        "If non-blank, first character must be non-blank.",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        "/ (slash)",
        ", (comma)",
        " (spaces)",
        "Blank"
    ]};

export const field_143 = {len: 2, pos_start: 1305, pos_end: 1307,
    idx: 143, name: "State", path: ["State"], fafsa_category: "26e", 
    validate: _validate_state_codes,
    note: [
        "Valid two letter code (See State Codes)",
        "Blank"
    ]};

export const field_144 = {len: 10, pos_start: 1307, pos_end: 1317,
    idx: 144, name: "Zip Code", path: ["Zip_Code"], fafsa_category: "26f", 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        "- (dash)",
        " (space)",
        "Blank"
    ]};

export const field_145 = {len: 2, pos_start: 1317, pos_end: 1319,
    idx: 145, name: "Country", path: ["Country"], fafsa_category: "26g", 
    validate: _validate_country_codes,
    note: [
        "Valid two letter code (See Country Codes)",
        "Blank"
    ]};


export const section_student_spouse_identity = /* #__PURE__ */ {
    section: "Student Spouse Demographic, Identity, and Contact Information",
    path: ["student_spouse","identity"],
    field_list: [field_132, field_133, field_134, field_135, field_136, field_137, field_138, field_139, field_140, field_141, field_142, field_143, field_144, field_145],
}


//*********************************************
// Section: Student Spouse Manually Entered Financial Information
//

export const field_146 = {len: 1, pos_start: 1319, pos_end: 1320,
    idx: 146, name: "Filed 1040 or 1040NR", path: ["Filed_1040_or_1040NR"], fafsa_category: "Student Spouse Tax Filing Status\n27a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_147 = {len: 1, pos_start: 1320, pos_end: 1321,
    idx: 147, name: "Filed non-U.S. tax return", path: ["Filed_non_US_tax_return"], fafsa_category: "27b", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_148 = {len: 1, pos_start: 1321, pos_end: 1322,
    idx: 148, name: "Tax Return Filing Status", path: ["Tax_Return_Filing_Status"], fafsa_category: "Student Spouse 20xx Tax Return Information\n28a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Single",
        "2": "Married-Filed Joint Return",
        "3": "Married-Filed Separate Return",
        "4": "Head of Household",
        "5": "Qualifying Surviving Spouse",
      }},
    ],
    note: [
        "1 = Single",
        "2 = Married-Filed Joint Return",
        "3 = Married-Filed Separate Return",
        "4 = Head of Household",
        "5 = Qualifying Surviving Spouse",
        "Blank"
    ]};

export const field_149 = {len: 11, pos_start: 1322, pos_end: 1333,
    idx: 149, name: "Income Earned from Work", path: ["Income_Earned_from_Work"], fafsa_category: "28b", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_150 = {len: 11, pos_start: 1333, pos_end: 1344,
    idx: 150, name: "Tax Exempt Interest Income", path: ["Tax_Exempt_Interest_Income"], fafsa_category: "28c", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_151 = {len: 11, pos_start: 1344, pos_end: 1355,
    idx: 151, name: "Untaxed Portions of IRA Distributions", path: ["Untaxed_Portions_of_IRA_Distributions"], fafsa_category: "28d", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_152 = {len: 11, pos_start: 1355, pos_end: 1366,
    idx: 152, name: "IRA Rollover", path: ["IRA_Rollover"], fafsa_category: "28e", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_153 = {len: 11, pos_start: 1366, pos_end: 1377,
    idx: 153, name: "Untaxed Portions of Pensions", path: ["Untaxed_Portions_of_Pensions"], fafsa_category: "28f", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_154 = {len: 11, pos_start: 1377, pos_end: 1388,
    idx: 154, name: "Pension Rollover", path: ["Pension_Rollover"], fafsa_category: "28g", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_155 = {len: 10, pos_start: 1388, pos_end: 1398,
    idx: 155, name: "Adjusted Gross Income", path: ["Adjusted_Gross_Income"], fafsa_category: "28h", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-999999999","max":"999999999"},
    ],
    note: [
        "-999999999 to 999999999",
        "Blank"
    ]};

export const field_156 = {len: 9, pos_start: 1398, pos_end: 1407,
    idx: 156, name: "Income Tax Paid", path: ["Income_Tax_Paid"], fafsa_category: "28i", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999"},
    ],
    note: [
        "0 to 999999999",
        "Blank"
    ]};

export const field_157 = {len: 11, pos_start: 1407, pos_end: 1418,
    idx: 157, name: "Deductible Payments to IRA, Keogh, Other", path: ["Deductible_Payments_to_IRA_Keogh_Other"], fafsa_category: "28j", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_158 = {len: 9, pos_start: 1418, pos_end: 1427,
    idx: 158, name: "Education Credits", path: ["Education_Credits"], fafsa_category: "28k", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999"},
    ],
    note: [
        "0 to 999999999",
        "Blank"
    ]};

export const field_159 = {len: 1, pos_start: 1427, pos_end: 1428,
    idx: 159, name: "Filed Schedule A, B, D, E, F or H?", path: ["Filed_Schedule_A_B_D_E_F_or_H"], fafsa_category: "28l", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
        "3": "Don't Know",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "3 = Don't Know",
        "Blank"
    ]};

export const field_160 = {len: 12, pos_start: 1428, pos_end: 1440,
    idx: 160, name: "Schedule C Amount", path: ["Schedule_C_Amount"], fafsa_category: "28m", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-99999999999","max":"99999999999"},
    ],
    note: [
        "-99999999999 to 99999999999",
        "Blank"
    ]};

export const field_161 = {len: 10, pos_start: 1440, pos_end: 1450,
    idx: 161, name: "Foreign Income Exempt from Federal Taxation", path: ["Foreign_Income_Exempt_from_Federal_Taxation"], fafsa_category: "28n", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-999999999","max":"999999999"},
    ],
    note: [
        "-999999999 to 999999999",
        "Blank"
    ]};

export const field_162 = {len: 1, pos_start: 1450, pos_end: 1451,
    idx: 162, name: "Consent to Retrieve and Disclose FTI", path: ["Consent_to_Retrieve_and_Disclose_FTI"], fafsa_category: "29a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Granted",
        "2": "Not Granted",
      }},
    ],
    note: [
        "1 = Granted",
        "2 = Not Granted",
        "Blank"
    ]};


export const section_student_spouse_financial_manual = /* #__PURE__ */ {
    section: "Student Spouse Manually Entered Financial Information",
    path: ["student_spouse","financial_manual"],
    field_list: [field_146, field_147, field_148, field_149, field_150, field_151, field_152, field_153, field_154, field_155, field_156, field_157, field_158, field_159, field_160, field_161, field_162],
}


//*********************************************
// Section: Student Spouse Consent and Signature
//

export const field_163 = {len: 1, pos_start: 1451, pos_end: 1452,
    idx: 163, name: "Signature", path: ["Signature"], fafsa_category: "29b", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_164 = {len: 8, pos_start: 1452, pos_end: 1460,
    idx: 164, name: "Signature Date", path: ["Signature_Date"], fafsa_category: "29c", 
    validate: _validate_date,
    "allow_blank":true,"options":[{"op":"range","min":"20231231","max":"20250930"}],
    note: [
        "Format is CCYYMMDD",
        "20231231 to 20250930",
        "Blank"
    ]};

export const field_165 = {len: 50, pos_start: 1460, pos_end: 1510,
    idx: 165, name: null, 
    extra: "Filler: Student Spouse",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};


export const section_student_spouse_consent = /* #__PURE__ */ {
    section: "Student Spouse Consent and Signature",
    path: ["student_spouse","consent"],
    field_list: [field_163, field_164, field_165],
}


//*********************************************
// Section: Parent Demographic, Identity, and Contact Information
//

export const field_166 = {len: 35, pos_start: 1510, pos_end: 1545,
    idx: 166, name: "First Name", path: ["First_Name"], fafsa_category: "Parent Identity Information\n30a", non_content: true, 
    note: [
        "First character must contain a letter and second character must be non-numeric",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)",
        "Blank"
    ]};

export const field_167 = {len: 15, pos_start: 1545, pos_end: 1560,
    idx: 167, name: "Middle Name", path: ["Middle_Name"], fafsa_category: "30b", non_content: true, 
    note: [
        "First character must contain a letter",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)",
        "Blank"
    ]};

export const field_168 = {len: 35, pos_start: 1560, pos_end: 1595,
    idx: 168, name: "Last Name", path: ["Last_Name"], fafsa_category: "30c", non_content: true, 
    note: [
        "First character must contain a letter and second character must be non-numeric",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)",
        "Blank"
    ]};

export const field_169 = {len: 10, pos_start: 1595, pos_end: 1605,
    idx: 169, name: "Suffix", path: ["Suffix"], fafsa_category: "30d", non_content: true, 
    note: [
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)",
        "Blank"
    ]};

export const field_170 = {len: 8, pos_start: 1605, pos_end: 1613,
    idx: 170, name: "Date of Birth", path: ["Date_of_Birth"], fafsa_category: "30e", 
    validate: _validate_date,
    "options":[{"op":"range","min":"19000101","max":"20251231"}],
    note: [
        "19000101 to current date",
        "Numeric within valid range.",
        "Format is CCYYMMDD where MM is 01-12, (CC is 19 and YY is 00 to 99) or (CC is 20 and YY is 00-23). Valid day range depending on month (see table below).",
        "Month Valid Day Range",
        " 01\t01-31",
        " 02\t01 to 28 (unless year is divisible by 4 for non-centurial years or 400 for centurial years, then 01 to 29 is valid)",
        " 03\t01-31",
        " 04\t01-30",
        " 05\t01-31",
        " 06\t01-30",
        " 07\t01-31",
        " 08\t01-31",
        " 09\t01-30",
        " 10\t01-31",
        " 11\t01-30",
        " 12\t01-31",
        "Blank"
    ]};

export const field_171 = {len: 9, pos_start: 1613, pos_end: 1622,
    idx: 171, name: "Social Security Number", path: ["Social_Security_Number"], fafsa_category: "30f", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000000","max":"999999999"},
    ],
    note: [
        "000000000 to 999999999",
        "Blank"
    ]};

export const field_172 = {len: 9, pos_start: 1622, pos_end: 1631,
    idx: 172, name: "ITIN", path: ["ITIN"], fafsa_category: "30g", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"900000000","max":"999999999"},
    ],
    note: [
        "900000000 to 999999999",
        "Blank"
    ]};

export const field_173 = {len: 10, pos_start: 1631, pos_end: 1641,
    idx: 173, name: "Phone Number", path: ["Phone_Number"], fafsa_category: "Parent Information\n31a", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0000000000","max":"9999999999"},
    ],
    note: [
        "0000000000 to 9999999999",
        "Blank"
    ]};

export const field_174 = {len: 50, pos_start: 1641, pos_end: 1691,
    idx: 174, name: "Email Address", path: ["Email_Address"], fafsa_category: "31b", 
    validate: _validate_options,
    options: [
      {op: "email", },
    ],
    note: [
        "1. One and only one at-sign '@' allowed.",
        "2. Before the at-sign:",
        "-at least one valid character",
        "-all characters in the range of ASCII 33 – 126, except for the following thirteen characters: < > ( ) [ ] \\ , ; : \" @ ^",
        "-period cannot be first, last or adjacent to another period.",
        "3. After the at-sign:",
        "-at least one valid character",
        "-only letters, digits, hyphen, underscore and period (A to Z, A to Z, 0 to 9, -, _, .)",
        "-Hyphen, underscore and period cannot be first, last, or adjacent to a period",
        "Blank"
    ]};

export const field_175 = {len: 40, pos_start: 1691, pos_end: 1731,
    idx: 175, name: "Street Address", path: ["Street_Address"], fafsa_category: "31c", non_content: true, 
    note: [
        "If non-blank, first character must be non-blank.",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        "# (number)",
        "@ (at)",
        "& (ampersand)",
        "/ (slash)",
        ", (comma)",
        " (spaces)",
        "Blank"
    ]};

export const field_176 = {len: 30, pos_start: 1731, pos_end: 1761,
    idx: 176, name: "City", path: ["City"], fafsa_category: "31d", non_content: true, 
    note: [
        "If non-blank, first character must be non-blank.",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        "/ (slash)",
        ", (comma)",
        " (spaces)",
        "Blank"
    ]};

export const field_177 = {len: 2, pos_start: 1761, pos_end: 1763,
    idx: 177, name: "State", path: ["State"], fafsa_category: "31e", 
    validate: _validate_state_codes,
    note: [
        "Valid two letter code (See State Codes)",
        "Blank"
    ]};

export const field_178 = {len: 10, pos_start: 1763, pos_end: 1773,
    idx: 178, name: "Zip Code", path: ["Zip_Code"], fafsa_category: "31f", 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        "- (dash)",
        " (space)",
        "Blank"
    ]};

export const field_179 = {len: 2, pos_start: 1773, pos_end: 1775,
    idx: 179, name: "Country", path: ["Country"], fafsa_category: "31g", 
    validate: _validate_country_codes,
    note: [
        "Valid two letter code (See Country Codes)",
        "Blank"
    ]};


export const section_parent_identity = /* #__PURE__ */ {
    section: "Parent Demographic, Identity, and Contact Information",
    path: ["parent","identity"],
    field_list: [field_166, field_167, field_168, field_169, field_170, field_171, field_172, field_173, field_174, field_175, field_176, field_177, field_178, field_179],
}


//*********************************************
// Section: Parent Non-Financial Information
//

export const field_180 = {len: 1, pos_start: 1775, pos_end: 1776,
    idx: 180, name: "Marital Status", path: ["Marital_Status"], fafsa_category: "Parent Current Marital Status\n32", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Never married",
        "2": "Unmarried, living together",
        "3": "Married (not separated)",
        "4": "Remarried",
        "5": "Divorced",
        "6": "Separated",
        "7": "Widowed",
      }},
    ],
    note: [
        "1 = Never married",
        "2 = Unmarried, living together",
        "3 = Married (not separated)",
        "4 = Remarried",
        "5 = Divorced",
        "6 = Separated",
        "7 = Widowed",
        "Blank"
    ]};

export const field_181 = {len: 2, pos_start: 1776, pos_end: 1778,
    idx: 181, name: "State of Legal Residence", path: ["State_of_Legal_Residence"], fafsa_category: "Parent State of Legal Residence\n33a", 
    validate: _validate_state_codes,
    note: [
        "Valid two letter code (See State Codes)",
        "Blank"
    ]};

export const field_182 = {len: 6, pos_start: 1778, pos_end: 1784,
    idx: 182, name: "Legal Residence Date", path: ["Legal_Residence_Date"], fafsa_category: "33b", 
    validate: _validate_yearmonth,
    "allow_blank":true,"options":[{"op":"range","min":"190001","max":"20251231"}],
    note: [
        "Numeric within valid date range; 190001 to current date",
        "Format is CCYYMM",
        "Blank"
    ]};

export const field_183 = {len: 2, pos_start: 1784, pos_end: 1786,
    idx: 183, name: "Updated Family Size", path: ["Updated_Family_Size"], fafsa_category: "Family Size\n34", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99"},
    ],
    note: [
        "0 to 99",
        "Blank"
    ]};

export const field_184 = {len: 2, pos_start: 1786, pos_end: 1788,
    idx: 184, name: "Number in College", path: ["Number_in_College"], fafsa_category: "Number in College\n35", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99"},
    ],
    note: [
        "0 to 99",
        "Blank"
    ]};


export const section_parent_non_financial = /* #__PURE__ */ {
    section: "Parent Non-Financial Information",
    path: ["parent","non_financial"],
    field_list: [field_180, field_181, field_182, field_183, field_184],
}


//*********************************************
// Section: Parent Manually Entered Financial Information
//

export const field_185 = {len: 1, pos_start: 1788, pos_end: 1789,
    idx: 185, name: "Received EITC", path: ["Received_EITC"], fafsa_category: "Federal Benefits Received\n36a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_186 = {len: 1, pos_start: 1789, pos_end: 1790,
    idx: 186, name: "Received Federal Housing Assistance", path: ["Received_Federal_Housing_Assistance"], fafsa_category: "36b", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_187 = {len: 1, pos_start: 1790, pos_end: 1791,
    idx: 187, name: "Received Free/Reduced Price Lunch", path: ["Received_FreeReduced_Price_Lunch"], fafsa_category: "36c", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_188 = {len: 1, pos_start: 1791, pos_end: 1792,
    idx: 188, name: "Received Medicaid", path: ["Received_Medicaid"], fafsa_category: "36d", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_189 = {len: 1, pos_start: 1792, pos_end: 1793,
    idx: 189, name: "Received Refundable Credit for 36B Health Plan", path: ["Received_Refundable_Credit_for_36B_Health_Plan"], fafsa_category: "36e", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_190 = {len: 1, pos_start: 1793, pos_end: 1794,
    idx: 190, name: "Received SNAP", path: ["Received_SNAP"], fafsa_category: "36f", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_191 = {len: 1, pos_start: 1794, pos_end: 1795,
    idx: 191, name: "Received Supplemental Security Income", path: ["Received_Supplemental_Security_Income"], fafsa_category: "36g", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_192 = {len: 1, pos_start: 1795, pos_end: 1796,
    idx: 192, name: "Received TANF", path: ["Received_TANF"], fafsa_category: "36h", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_193 = {len: 1, pos_start: 1796, pos_end: 1797,
    idx: 193, name: "Received WIC", path: ["Received_WIC"], fafsa_category: "36i", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_194 = {len: 1, pos_start: 1797, pos_end: 1798,
    idx: 194, name: "Federal Benefits: None of the Above", path: ["Federal_Benefits_None_of_the_Above"], fafsa_category: "36j", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_195 = {len: 1, pos_start: 1798, pos_end: 1799,
    idx: 195, name: "Filed 1040 or 1040NR", path: ["Filed_1040_or_1040NR"], fafsa_category: "37a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_196 = {len: 1, pos_start: 1799, pos_end: 1800,
    idx: 196, name: "Filed non-U.S. tax return", path: ["Filed_non_US_tax_return"], fafsa_category: "37b", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Filed or will file a tax return with Puerto Rico or another U.S. territory",
        "2": "Filed or will file a foreign tax return",
        "3": "Did not and will not file a foreign tax return – earned income in a foreign country or employee of an international organization that did not require tax filing",
        "4": "Did not and will not file a U.S. tax return – earned U.S. income below the tax filing threshold",
        "5": "Did not and will not file a U.S. tax return – reasons other than low income",
        "6": "Did not and will not file any tax return – no earned income",
      }},
    ],
    note: [
        "1 = Filed or will file a tax return with Puerto Rico or another U.S. territory",
        "2 = Filed or will file a foreign tax return",
        "3 = Did not and will not file a foreign tax return – earned income in a foreign country or employee of an international organization that did not require tax filing",
        "4 = Did not and will not file a U.S. tax return – earned U.S. income below the tax filing threshold",
        "5 = Did not and will not file a U.S. tax return – reasons other than low income",
        "6 = Did not and will not file any tax return – no earned income",
        "Blank"
    ]};

export const field_197 = {len: 1, pos_start: 1800, pos_end: 1801,
    idx: 197, name: "Filed Joint Return With Current Spouse", path: ["Filed_Joint_Return_With_Current_Spouse"], fafsa_category: "37c", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_198 = {len: 1, pos_start: 1801, pos_end: 1802,
    idx: 198, name: "Tax Return Filing Status", path: ["Tax_Return_Filing_Status"], fafsa_category: "38a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Single",
        "2": "Married-Filed Joint Return",
        "3": "Married-Filed Separate Return",
        "4": "Head of Household",
        "5": "Qualifying Surviving Spouse",
      }},
    ],
    note: [
        "1 = Single",
        "2 = Married-Filed Joint Return",
        "3 = Married-Filed Separate Return",
        "4 = Head of Household",
        "5 = Qualifying Surviving Spouse",
        "Blank"
    ]};

export const field_199 = {len: 11, pos_start: 1802, pos_end: 1813,
    idx: 199, name: "Income Earned from Work", path: ["Income_Earned_from_Work"], fafsa_category: "38b", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_200 = {len: 11, pos_start: 1813, pos_end: 1824,
    idx: 200, name: "Tax Exempt Interest Income", path: ["Tax_Exempt_Interest_Income"], fafsa_category: "38c", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_201 = {len: 11, pos_start: 1824, pos_end: 1835,
    idx: 201, name: "Untaxed Portions of IRA Distributions", path: ["Untaxed_Portions_of_IRA_Distributions"], fafsa_category: "38d", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_202 = {len: 11, pos_start: 1835, pos_end: 1846,
    idx: 202, name: "IRA Rollover", path: ["IRA_Rollover"], fafsa_category: "38e", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_203 = {len: 11, pos_start: 1846, pos_end: 1857,
    idx: 203, name: "Untaxed Portions of Pensions", path: ["Untaxed_Portions_of_Pensions"], fafsa_category: "38f", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_204 = {len: 11, pos_start: 1857, pos_end: 1868,
    idx: 204, name: "Pension Rollover", path: ["Pension_Rollover"], fafsa_category: "38g", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_205 = {len: 10, pos_start: 1868, pos_end: 1878,
    idx: 205, name: "Adjusted Gross Income", path: ["Adjusted_Gross_Income"], fafsa_category: "38h", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-999999999","max":"999999999"},
    ],
    note: [
        "-999999999 to 999999999",
        "Blank"
    ]};

export const field_206 = {len: 9, pos_start: 1878, pos_end: 1887,
    idx: 206, name: "Income Tax Paid", path: ["Income_Tax_Paid"], fafsa_category: "38i", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999"},
    ],
    note: [
        "0 to 999999999",
        "Blank"
    ]};

export const field_207 = {len: 1, pos_start: 1887, pos_end: 1888,
    idx: 207, name: "Earned Income Tax Credit Received During Tax Year?", path: ["Earned_Income_Tax_Credit_Received_During_Tax_Year"], fafsa_category: "38j", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
        "3": "Don't Know",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "3 = Don't Know",
        "Blank"
    ]};

export const field_208 = {len: 11, pos_start: 1888, pos_end: 1899,
    idx: 208, name: "Deductible Payments to IRA, Keogh, Other", path: ["Deductible_Payments_to_IRA_Keogh_Other"], fafsa_category: "38k", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_209 = {len: 9, pos_start: 1899, pos_end: 1908,
    idx: 209, name: "Education Credits", path: ["Education_Credits"], fafsa_category: "38l", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999"},
    ],
    note: [
        "0 to 999999999",
        "Blank"
    ]};

export const field_210 = {len: 1, pos_start: 1908, pos_end: 1909,
    idx: 210, name: "Filed Schedule A, B, D, E, F or H?", path: ["Filed_Schedule_A_B_D_E_F_or_H"], fafsa_category: "38m", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
        "3": "Don't Know",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "3 = Don't Know",
        "Blank"
    ]};

export const field_211 = {len: 12, pos_start: 1909, pos_end: 1921,
    idx: 211, name: "Schedule C Amount", path: ["Schedule_C_Amount"], fafsa_category: "38n", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-99999999999","max":"99999999999"},
    ],
    note: [
        "-99999999999 to 99999999999",
        "Blank"
    ]};

export const field_212 = {len: 7, pos_start: 1921, pos_end: 1928,
    idx: 212, name: "College Grant and Scholarship Aid", path: ["College_Grant_and_Scholarship_Aid"], fafsa_category: "38o", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"9999999"},
    ],
    note: [
        "0 to 9999999",
        "Blank"
    ]};

export const field_213 = {len: 10, pos_start: 1928, pos_end: 1938,
    idx: 213, name: "Foreign Earned Income Exclusion", path: ["Foreign_Earned_Income_Exclusion"], fafsa_category: "38p", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-999999999","max":"999999999"},
    ],
    note: [
        "-999999999 to 999999999",
        "Blank"
    ]};

export const field_214 = {len: 7, pos_start: 1938, pos_end: 1945,
    idx: 214, name: "Child Support Received", path: ["Child_Support_Received"], fafsa_category: "Annual Child Support Received \n39", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"9999999"},
    ],
    note: [
        "0 to 9999999",
        "Blank"
    ]};

export const field_215 = {len: 7, pos_start: 1945, pos_end: 1952,
    idx: 215, name: "Total of Cash, Savings, and Checking Accounts", path: ["Total_of_Cash_Savings_and_Checking_Accounts"], fafsa_category: "Parent Assets\n40a", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"9999999"},
    ],
    note: [
        "0 to 9999999",
        "Blank"
    ]};

export const field_216 = {len: 7, pos_start: 1952, pos_end: 1959,
    idx: 216, name: "Net Worth of Current Investments", path: ["Net_Worth_of_Current_Investments"], fafsa_category: "40b", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"9999999"},
    ],
    note: [
        "0 to 9999999",
        "Blank"
    ]};

export const field_217 = {len: 7, pos_start: 1959, pos_end: 1966,
    idx: 217, name: "Net Worth of Businesses and Investment Farms", path: ["Net_Worth_of_Businesses_and_Investment_Farms"], fafsa_category: "40c", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"9999999"},
    ],
    note: [
        "0 to 9999999",
        "Blank"
    ]};

export const field_218 = {len: 1, pos_start: 1966, pos_end: 1967,
    idx: 218, name: "Consent to Retrieve and Disclose FTI", path: ["Consent_to_Retrieve_and_Disclose_FTI"], fafsa_category: "Parent Consent and Signature\n41a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Granted",
        "2": "Not Granted",
      }},
    ],
    note: [
        "1 = Granted",
        "2 = Not Granted",
        "Blank"
    ]};


export const section_parent_financial_manual = /* #__PURE__ */ {
    section: "Parent Manually Entered Financial Information",
    path: ["parent","financial_manual"],
    field_list: [field_185, field_186, field_187, field_188, field_189, field_190, field_191, field_192, field_193, field_194, field_195, field_196, field_197, field_198, field_199, field_200, field_201, field_202, field_203, field_204, field_205, field_206, field_207, field_208, field_209, field_210, field_211, field_212, field_213, field_214, field_215, field_216, field_217, field_218],
}


//*********************************************
// Section: Parent Consent and Signature
//

export const field_219 = {len: 1, pos_start: 1967, pos_end: 1968,
    idx: 219, name: "Signature", path: ["Signature"], fafsa_category: "41b", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_220 = {len: 8, pos_start: 1968, pos_end: 1976,
    idx: 220, name: "Signature Date", path: ["Signature_Date"], fafsa_category: "41c", 
    validate: _validate_date,
    "allow_blank":true,"options":[{"op":"range","min":"20231231","max":"20250930"}],
    note: [
        "Format is CCYYMMDD",
        "20231231 to 20250930",
        "Blank"
    ]};

export const field_221 = {len: 50, pos_start: 1976, pos_end: 2026,
    idx: 221, name: null, 
    extra: "Filler: Parent",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};


export const section_parent_consent = /* #__PURE__ */ {
    section: "Parent Consent and Signature",
    path: ["parent","consent"],
    field_list: [field_219, field_220, field_221],
}


//*********************************************
// Section: Parent Spouse or Partner Demographic, Identity, and Contact Information
//

export const field_222 = {len: 35, pos_start: 2026, pos_end: 2061,
    idx: 222, name: "First Name", path: ["First_Name"], fafsa_category: "Parent Spouse or Partner Identity\n42a", non_content: true, 
    note: [
        "First character must contain a letter and second character must be non-numeric",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)",
        "Blank"
    ]};

export const field_223 = {len: 15, pos_start: 2061, pos_end: 2076,
    idx: 223, name: "Middle Name", path: ["Middle_Name"], fafsa_category: "42b", non_content: true, 
    note: [
        "First character must contain a letter",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)",
        "Blank"
    ]};

export const field_224 = {len: 35, pos_start: 2076, pos_end: 2111,
    idx: 224, name: "Last Name", path: ["Last_Name"], fafsa_category: "42c", non_content: true, 
    note: [
        "First character must contain a letter and second character must be non-numeric",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)",
        "Blank"
    ]};

export const field_225 = {len: 10, pos_start: 2111, pos_end: 2121,
    idx: 225, name: "Suffix", path: ["Suffix"], fafsa_category: "42d", non_content: true, 
    note: [
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)",
        "Blank"
    ]};

export const field_226 = {len: 8, pos_start: 2121, pos_end: 2129,
    idx: 226, name: "Date of Birth", path: ["Date_of_Birth"], fafsa_category: "42e", 
    validate: _validate_date,
    "options":[{"op":"range","min":"19000101","max":"20251231"}],
    note: [
        "19000101 to current date",
        "Numeric within valid range.",
        "Format is CCYYMMDD where MM is 01-12, (CC is 19 and YY is 00 to 99) or (CC is 20 and YY is 00-23). Valid day range depending on month (see table below).",
        "Month Valid Day Range",
        " 01\t01-31",
        " 02\t01 to 28 (unless year is divisible by 4 for non-centurial years or 400 for centurial years, then 01 to 29 is valid)",
        " 03\t01-31",
        " 04\t01-30",
        " 05\t01-31",
        " 06\t01-30",
        " 07\t01-31",
        " 08\t01-31",
        " 09\t01-30",
        " 10\t01-31",
        " 11\t01-30",
        " 12\t01-31",
        "Blank"
    ]};

export const field_227 = {len: 9, pos_start: 2129, pos_end: 2138,
    idx: 227, name: "Social Security Number", path: ["Social_Security_Number"], fafsa_category: "42f", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000000","max":"999999999"},
    ],
    note: [
        "000000000 to 999999999",
        "Blank"
    ]};

export const field_228 = {len: 9, pos_start: 2138, pos_end: 2147,
    idx: 228, name: "ITIN", path: ["ITIN"], fafsa_category: "42g", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"900000000","max":"999999999"},
    ],
    note: [
        "900000000 to 999999999",
        "Blank"
    ]};

export const field_229 = {len: 10, pos_start: 2147, pos_end: 2157,
    idx: 229, name: "Phone Number", path: ["Phone_Number"], fafsa_category: "43a", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0000000000","max":"9999999999"},
    ],
    note: [
        "0000000000 to 9999999999",
        "Blank"
    ]};

export const field_230 = {len: 50, pos_start: 2157, pos_end: 2207,
    idx: 230, name: "Email Address", path: ["Email_Address"], fafsa_category: "43b", 
    validate: _validate_options,
    options: [
      {op: "email", },
    ],
    note: [
        "1. One and only one at-sign '@' allowed.",
        "2. Before the at-sign:",
        "-at least one valid character",
        "-all characters in the range of ASCII 33 – 126, except for the following thirteen characters: < > ( ) [ ] \\ , ; : \" @ ^",
        "-period cannot be first, last or adjacent to another period.",
        "3. After the at-sign:",
        "-at least one valid character",
        "-only letters, digits, hyphen, underscore and period (A to Z, A to Z, 0 to 9, -, _, .)",
        "-Hyphen, underscore and period cannot be first, last, or adjacent to a period",
        "Blank"
    ]};

export const field_231 = {len: 40, pos_start: 2207, pos_end: 2247,
    idx: 231, name: "Street Address", path: ["Street_Address"], fafsa_category: "43c", non_content: true, 
    note: [
        "If non-blank, first character must be non-blank.",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        "# (number)",
        "@ (at)",
        "& (ampersand)",
        "/ (slash)",
        ", (comma)",
        " (spaces)",
        "Blank"
    ]};

export const field_232 = {len: 30, pos_start: 2247, pos_end: 2277,
    idx: 232, name: "City", path: ["City"], fafsa_category: "43d", non_content: true, 
    note: [
        "If non-blank, first character must be non-blank.",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        "/ (slash)",
        ", (comma)",
        " (spaces)",
        "Blank"
    ]};

export const field_233 = {len: 2, pos_start: 2277, pos_end: 2279,
    idx: 233, name: "State", path: ["State"], fafsa_category: "43e", 
    validate: _validate_state_codes,
    note: [
        "Valid two letter code (See State Codes)",
        "Blank"
    ]};

export const field_234 = {len: 10, pos_start: 2279, pos_end: 2289,
    idx: 234, name: "Zip Code", path: ["Zip_Code"], fafsa_category: "43f", 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        "- (dash)",
        " (space)",
        "Blank"
    ]};

export const field_235 = {len: 2, pos_start: 2289, pos_end: 2291,
    idx: 235, name: "Country", path: ["Country"], fafsa_category: "43g", 
    validate: _validate_country_codes,
    note: [
        "Valid two letter code (See Country Codes)",
        "Blank"
    ]};


export const section_parent_spouse_identity = /* #__PURE__ */ {
    section: "Parent Spouse or Partner Demographic, Identity, and Contact Information",
    path: ["parent_spouse","identity"],
    field_list: [field_222, field_223, field_224, field_225, field_226, field_227, field_228, field_229, field_230, field_231, field_232, field_233, field_234, field_235],
}


//*********************************************
// Section: Parent Spouse or Partner Manually Entered Financial Information
//

export const field_236 = {len: 1, pos_start: 2291, pos_end: 2292,
    idx: 236, name: "Filed 1040 or 1040NR", path: ["Filed_1040_or_1040NR"], fafsa_category: "Parent Spouse or Partner Tax Filing Status\n44a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_237 = {len: 1, pos_start: 2292, pos_end: 2293,
    idx: 237, name: "Filed non-U.S. tax return", path: ["Filed_non_US_tax_return"], fafsa_category: "44b", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Filed or will file a tax return with Puerto Rico or another U.S. territory",
        "2": "Filed or will file a foreign tax return",
        "3": "Did not and will not file a foreign tax return – earned income in a foreign country or employee of an international organization that did not require tax filing",
        "4": "Did not and will not file a U.S. tax return – earned U.S. income below the tax filing threshold",
        "5": "Did not and will not file a U.S. tax return – reasons other than low income",
        "6": "Did not and will not file any tax return – no earned income",
      }},
    ],
    note: [
        "1 = Filed or will file a tax return with Puerto Rico or another U.S. territory",
        "2 = Filed or will file a foreign tax return",
        "3 = Did not and will not file a foreign tax return – earned income in a foreign country or employee of an international organization that did not require tax filing",
        "4 = Did not and will not file a U.S. tax return – earned U.S. income below the tax filing threshold",
        "5 = Did not and will not file a U.S. tax return – reasons other than low income",
        "6 = Did not and will not file any tax return – no earned income",
        "Blank"
    ]};

export const field_238 = {len: 1, pos_start: 2293, pos_end: 2294,
    idx: 238, name: "Tax Return Filing Status", path: ["Tax_Return_Filing_Status"], fafsa_category: "Parent Spouse or Partner 20xx Tax Return Information\n45a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Single",
        "2": "Married-Filed Joint Return",
        "3": "Married-Filed Separate Return",
        "4": "Head of Household",
        "5": "Qualifying Surviving Spouse",
      }},
    ],
    note: [
        "1 = Single",
        "2 = Married-Filed Joint Return",
        "3 = Married-Filed Separate Return",
        "4 = Head of Household",
        "5 = Qualifying Surviving Spouse",
        "Blank"
    ]};

export const field_239 = {len: 11, pos_start: 2294, pos_end: 2305,
    idx: 239, name: "Income Earned from Work", path: ["Income_Earned_from_Work"], fafsa_category: "45b", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_240 = {len: 11, pos_start: 2305, pos_end: 2316,
    idx: 240, name: "Tax Exempt Interest Income", path: ["Tax_Exempt_Interest_Income"], fafsa_category: "45c", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_241 = {len: 11, pos_start: 2316, pos_end: 2327,
    idx: 241, name: "Untaxed Portions of IRA Distributions", path: ["Untaxed_Portions_of_IRA_Distributions"], fafsa_category: "45d", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_242 = {len: 11, pos_start: 2327, pos_end: 2338,
    idx: 242, name: "IRA Rollover", path: ["IRA_Rollover"], fafsa_category: "45e", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_243 = {len: 11, pos_start: 2338, pos_end: 2349,
    idx: 243, name: "Untaxed Portions of Pensions", path: ["Untaxed_Portions_of_Pensions"], fafsa_category: "45f", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_244 = {len: 11, pos_start: 2349, pos_end: 2360,
    idx: 244, name: "Pension Rollover", path: ["Pension_Rollover"], fafsa_category: "45g", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_245 = {len: 10, pos_start: 2360, pos_end: 2370,
    idx: 245, name: "Adjusted Gross Income", path: ["Adjusted_Gross_Income"], fafsa_category: "45h", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-999999999","max":"999999999"},
    ],
    note: [
        "-999999999 to 999999999",
        "Blank"
    ]};

export const field_246 = {len: 9, pos_start: 2370, pos_end: 2379,
    idx: 246, name: "Income Tax Paid", path: ["Income_Tax_Paid"], fafsa_category: "45i", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999"},
    ],
    note: [
        "0 to 999999999",
        "Blank"
    ]};

export const field_247 = {len: 11, pos_start: 2379, pos_end: 2390,
    idx: 247, name: "Deductible Payments to IRA, Keogh, Other", path: ["Deductible_Payments_to_IRA_Keogh_Other"], fafsa_category: "45j", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_248 = {len: 9, pos_start: 2390, pos_end: 2399,
    idx: 248, name: "Education Credits", path: ["Education_Credits"], fafsa_category: "45k", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999"},
    ],
    note: [
        "0 to 999999999",
        "Blank"
    ]};

export const field_249 = {len: 1, pos_start: 2399, pos_end: 2400,
    idx: 249, name: "Filed Schedule A, B, D, E, F or H?", path: ["Filed_Schedule_A_B_D_E_F_or_H"], fafsa_category: "45l", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
        "3": "Don't Know",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "3 = Don't Know",
        "Blank"
    ]};

export const field_250 = {len: 12, pos_start: 2400, pos_end: 2412,
    idx: 250, name: "Schedule C Amount", path: ["Schedule_C_Amount"], fafsa_category: "45m", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-99999999999","max":"99999999999"},
    ],
    note: [
        "-99999999999 to 99999999999",
        "Blank"
    ]};

export const field_251 = {len: 10, pos_start: 2412, pos_end: 2422,
    idx: 251, name: "Foreign Income Exempt from Federal Taxation", path: ["Foreign_Income_Exempt_from_Federal_Taxation"], fafsa_category: "45n", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-999999999","max":"999999999"},
    ],
    note: [
        "-999999999 to 999999999",
        "Blank"
    ]};

export const field_252 = {len: 1, pos_start: 2422, pos_end: 2423,
    idx: 252, name: "Consent to Retrieve and Disclose FTI", path: ["Consent_to_Retrieve_and_Disclose_FTI"], fafsa_category: "Parent Spouse or Partner Consent and Signature \n46a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Granted",
        "2": "Not Granted",
      }},
    ],
    note: [
        "1 = Granted",
        "2 = Not Granted",
        "Blank"
    ]};


export const section_parent_spouse_financial_manual = /* #__PURE__ */ {
    section: "Parent Spouse or Partner Manually Entered Financial Information",
    path: ["parent_spouse","financial_manual"],
    field_list: [field_236, field_237, field_238, field_239, field_240, field_241, field_242, field_243, field_244, field_245, field_246, field_247, field_248, field_249, field_250, field_251, field_252],
}


//*********************************************
// Section: Parent Spouse or Partner Consent and Signature
//

export const field_253 = {len: 1, pos_start: 2423, pos_end: 2424,
    idx: 253, name: "Signature", path: ["Signature"], fafsa_category: "46b", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_254 = {len: 8, pos_start: 2424, pos_end: 2432,
    idx: 254, name: "Signature Date", path: ["Signature_Date"], fafsa_category: "46c", 
    validate: _validate_date,
    "allow_blank":true,"options":[{"op":"range","min":"20231231","max":"20250930"}],
    note: [
        "Format is CCYYMMDD",
        "20231231 to 20250930",
        "Blank"
    ]};

export const field_255 = {len: 50, pos_start: 2432, pos_end: 2482,
    idx: 255, name: null, 
    extra: "Filler: Parent Spouse or Partner",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};


export const section_parent_spouse_consent = /* #__PURE__ */ {
    section: "Parent Spouse or Partner Consent and Signature",
    path: ["parent_spouse","consent"],
    field_list: [field_253, field_254, field_255],
}


//*********************************************
// Section: Preparer Information Indicates that a preparer filled out the application and provided their credentials
//

export const field_256 = {len: 35, pos_start: 2482, pos_end: 2517,
    idx: 256, name: "First Name", path: ["First_Name"], fafsa_category: "Preparer Identity\n47a", non_content: true, 
    note: [
        "First character must contain a letter and second character must be non-numeric",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)",
        "Blank"
    ]};

export const field_257 = {len: 35, pos_start: 2517, pos_end: 2552,
    idx: 257, name: "Last Name", path: ["Last_Name"], fafsa_category: "47b", non_content: true, 
    note: [
        "First character must contain a letter and second character must be non-numeric",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        " (space)",
        "Blank"
    ]};

export const field_258 = {len: 9, pos_start: 2552, pos_end: 2561,
    idx: 258, name: "Social Security Number", path: ["Social_Security_Number"], fafsa_category: "47c", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"001010001","max":"999999999"},
    ],
    note: [
        "001010001 to 999999999",
        "Blank"
    ]};

export const field_259 = {len: 9, pos_start: 2561, pos_end: 2570,
    idx: 259, name: "EIN", path: ["EIN"], fafsa_category: "47d", 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000000","max":"999999999"},
    ],
    note: [
        "000000000 to 999999999",
        "Blank"
    ]};

export const field_260 = {len: 30, pos_start: 2570, pos_end: 2600,
    idx: 260, name: "Affiliation", path: ["Affiliation"], fafsa_category: "Preparer Information\n48a", non_content: true, 
    note: [
        "If non-blank, first character must be non-blank.",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        "# (number)",
        "@ (at)",
        "% (percent or care of)",
        "& (ampersand)",
        "/ (slash)",
        ", (comma)",
        " (spaces)",
        "Blank"
    ]};

export const field_261 = {len: 40, pos_start: 2600, pos_end: 2640,
    idx: 261, name: "Street Address", path: ["Street_Address"], fafsa_category: "48b", non_content: true, 
    note: [
        "If non-blank, first character must be non-blank.",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        "# (number)",
        "@ (at)",
        "& (ampersand)",
        "/ (slash)",
        ", (comma)",
        " (spaces)",
        "Blank"
    ]};

export const field_262 = {len: 30, pos_start: 2640, pos_end: 2670,
    idx: 262, name: "City", path: ["City"], fafsa_category: "48c", non_content: true, 
    note: [
        "If non-blank, first character must be non-blank.",
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        ". (period)",
        "- (dash)",
        "' (apostrophe)",
        "/ (slash)",
        ", (comma)",
        " (spaces)",
        "Blank"
    ]};

export const field_263 = {len: 2, pos_start: 2670, pos_end: 2672,
    idx: 263, name: "State", path: ["State"], fafsa_category: "48d", 
    validate: _validate_state_codes,
    note: [
        "Valid two letter code (See State Codes)",
        "Blank"
    ]};

export const field_264 = {len: 10, pos_start: 2672, pos_end: 2682,
    idx: 264, name: "Zip Code", path: ["Zip_Code"], fafsa_category: "48e", 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alphanumeric: 0 to 9 and uppercase and lowercase A to Z",
        "- (dash)",
        " (space)",
        "Blank"
    ]};

export const field_265 = {len: 1, pos_start: 2682, pos_end: 2683,
    idx: 265, name: "Signature", path: ["Signature"], fafsa_category: "Preparer Signature\n49a", 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_266 = {len: 8, pos_start: 2683, pos_end: 2691,
    idx: 266, name: "Signature Date", path: ["Signature_Date"], fafsa_category: "49b", 
    validate: _validate_date,
    "allow_blank":true,"options":[{"op":"range","min":"20231231","max":"20250930"}],
    note: [
        "Format is CCYYMMDD",
        "20231231 to 20250930",
        "Blank"
    ]};

export const field_267 = {len: 50, pos_start: 2691, pos_end: 2741,
    idx: 267, name: null, 
    extra: "Filler: Preparer",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};


export const section_preparer = /* #__PURE__ */ {
    section: "Preparer Information Indicates that a preparer filled out the application and provided their credentials",
    path: ["preparer"],
    field_list: [field_256, field_257, field_258, field_259, field_260, field_261, field_262, field_263, field_264, field_265, field_266, field_267],
}


//*********************************************
// Section: FPS Processing Information
//

export const field_268 = {len: 1, pos_start: 2741, pos_end: 2742,
    idx: 268, name: "Student Affirmation Status", path: ["student","Affirmation_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_269 = {len: 1, pos_start: 2742, pos_end: 2743,
    idx: 269, name: "Student Spouse Affirmation Status", path: ["student_spouse","Affirmation_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_270 = {len: 1, pos_start: 2743, pos_end: 2744,
    idx: 270, name: "Parent Affirmation Status", path: ["parent","Affirmation_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_271 = {len: 1, pos_start: 2744, pos_end: 2745,
    idx: 271, name: "Parent Spouse or Partner Affirmation Status", path: ["parent_spouse","Affirmation_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_272 = {len: 8, pos_start: 2745, pos_end: 2753,
    idx: 272, name: "Student Date Consent Granted", path: ["student","Date_Consent_Granted"], 
    validate: _validate_date,
    "allow_blank":true,"options":[{"op":"range","min":"19000101","max":"20251231"}],
    note: [
        "Numeric within valid date range; 19000101 to 20251231",
        "Format is CCYYMMDD",
        "Blank"
    ]};

export const field_273 = {len: 8, pos_start: 2753, pos_end: 2761,
    idx: 273, name: "Student Spouse Date Consent Granted", path: ["student_spouse","Date_Consent_Granted"], 
    validate: _validate_date,
    "allow_blank":true,"options":[{"op":"range","min":"19000101","max":"20251231"}],
    note: [
        "Numeric within valid date range; 19000101 to 20251231",
        "Format is CCYYMMDD",
        "Blank"
    ]};

export const field_274 = {len: 8, pos_start: 2761, pos_end: 2769,
    idx: 274, name: "Parent Date Consent Granted", path: ["parent","Date_Consent_Granted"], 
    validate: _validate_date,
    "allow_blank":true,"options":[{"op":"range","min":"19000101","max":"20251231"}],
    note: [
        "Numeric within valid date range; 19000101 to 20251231",
        "Format is CCYYMMDD",
        "Blank"
    ]};

export const field_275 = {len: 8, pos_start: 2769, pos_end: 2777,
    idx: 275, name: "Parent Spouse or Partner Date Consent Granted", path: ["parent_spouse","Date_Consent_Granted"], 
    validate: _validate_date,
    "allow_blank":true,"options":[{"op":"range","min":"19000101","max":"20251231"}],
    note: [
        "Numeric within valid date range; 19000101 to 20251231",
        "Format is CCYYMMDD",
        "Blank"
    ]};

export const field_276 = {len: 1, pos_start: 2777, pos_end: 2778,
    idx: 276, name: "Student Transunion Match Status", path: ["student","Transunion_Match_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "No match",
        "2": "Date of birth mismatch",
        "3": "First name mismatch",
        "4": "Last name mismatch",
        "5": "Address mismatch",
        "6": "Full match",
      }},
    ],
    note: [
        "1 = No match",
        "2 = Date of birth mismatch",
        "3 = First name mismatch",
        "4 = Last name mismatch",
        "5 = Address mismatch",
        "6 = Full match",
        "Blank"
    ]};

export const field_277 = {len: 1, pos_start: 2778, pos_end: 2779,
    idx: 277, name: "Student Spouse Transunion Match Status", path: ["student_spouse","Transunion_Match_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "No match",
        "2": "Date of birth mismatch",
        "3": "First name mismatch",
        "4": "Last name mismatch",
        "5": "Address mismatch",
        "6": "Full match",
      }},
    ],
    note: [
        "1 = No match",
        "2 = Date of birth mismatch",
        "3 = First name mismatch",
        "4 = Last name mismatch",
        "5 = Address mismatch",
        "6 = Full match",
        "Blank"
    ]};

export const field_278 = {len: 1, pos_start: 2779, pos_end: 2780,
    idx: 278, name: "Parent Transunion Match Status", path: ["parent","Transunion_Match_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "No match",
        "2": "Date of birth mismatch",
        "3": "First name mismatch",
        "4": "Last name mismatch",
        "5": "Address mismatch",
        "6": "Full match",
      }},
    ],
    note: [
        "1 = No match",
        "2 = Date of birth mismatch",
        "3 = First name mismatch",
        "4 = Last name mismatch",
        "5 = Address mismatch",
        "6 = Full match",
        "Blank"
    ]};

export const field_279 = {len: 1, pos_start: 2780, pos_end: 2781,
    idx: 279, name: "Parent Spouse or Partner Transunion Match Status", path: ["parent_spouse","Transunion_Match_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "No match",
        "2": "Date of birth mismatch",
        "3": "First name mismatch",
        "4": "Last name mismatch",
        "5": "Address mismatch",
        "6": "Full match",
      }},
    ],
    note: [
        "1 = No match",
        "2 = Date of birth mismatch",
        "3 = First name mismatch",
        "4 = Last name mismatch",
        "5 = Address mismatch",
        "6 = Full match",
        "Blank"
    ]};

export const field_280 = {len: 2, pos_start: 2781, pos_end: 2783,
    idx: 280, name: "Correction Applied against Transaction Number", path: ["Correction_Applied_against_Transaction_Number"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"01","max":"99"},
      {op: "enum", options: {
        "": "Transaction not a result of a correction",
      }},
    ],
    note: [
        "01 to 99",
        "Blank = Transaction not a result of a correction"
    ]};

export const field_281 = {len: 1, pos_start: 2783, pos_end: 2784,
    idx: 281, name: "Professional Judgment", path: ["Professional_Judgment"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "Failed professional judgment",
        "": "No professional judgment requested",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = Failed professional judgment",
        "Blank = No professional judgment requested"
    ]};

export const field_282 = {len: 1, pos_start: 2784, pos_end: 2785,
    idx: 282, name: "Dependency Override Indicator", path: ["Dependency_Override_Indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Dependent to Independent Override",
        "2": "Override Canceled",
        "3": "Failed Dependency Override",
        "": "No FAA override",
      }},
    ],
    note: [
        "1 = Dependent to Independent Override",
        "2 = Override Canceled",
        "3 = Failed Dependency Override",
        "Blank = No FAA override"
    ]};

export const field_283 = {len: 6, pos_start: 2785, pos_end: 2791,
    idx: 283, name: "FAA Federal School Code", path: ["FAA_Federal_School_Code"], 
    validate: _validate_school_code,
    note: [
        "X00000 to X99999",
        "Valid characters for first position are 0 (zero), B, E, or G",
        "Blank = Always blank on school and servicer ISIRs; for state agencies, no dependency override or professional judgment done"
    ]};

export const field_284 = {len: 1, pos_start: 2791, pos_end: 2792,
    idx: 284, name: "FAA Signature", path: ["FAA_Signature"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
      }},
    ],
    note: [
        "1 = Yes",
        "Blank"
    ]};

export const field_285 = {len: 1, pos_start: 2792, pos_end: 2793,
    idx: 285, name: "IASG indicator", path: ["IASG_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Eligible for IASG",
        "2": "Eligible, grandfathered for IASG",
        "3": "Not Eligible for IASG",
        "": "No Determination",
      }},
    ],
    note: [
        "1 = Eligible for IASG",
        "2 = Eligible, grandfathered for IASG",
        "3 = Not Eligible for IASG",
        "Blank = No Determination"
    ]};

export const field_286 = {len: 1, pos_start: 2793, pos_end: 2794,
    idx: 286, name: "Children of Fallen Heroes Indicator", path: ["Children_of_Fallen_Heroes_Indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Eligible for CFH",
        "2": "Eligible, grandfathered for CFH",
        "3": "Not Eligible for CFH",
        "": "No Determination",
      }},
    ],
    note: [
        "1 = Eligible for CFH",
        "2 = Eligible, grandfathered for CFH",
        "3 = Not Eligible for CFH",
        "Blank = No Determination"
    ]};

export const field_287 = {len: 7, pos_start: 2794, pos_end: 2801,
    idx: 287, name: "Electronic Transaction Indicator Destination Number", alias: "ETI", path: ["Electronic_Transaction_Indicator_Destination_Number"], 
    extra: ["TG number assigned by SAIG."],
    validate: _validate_options,
    options: [
      {op: "eti_destination", },
    ],
    note: [
        "“TGXXXXX” where XXXXX is the 5-digit alphanumeric code assigned by SAIG staff",
        "Blank"
    ]};

export const field_288 = {len: 1, pos_start: 2801, pos_end: 2802,
    idx: 288, name: "Student Signature Source", path: ["student","Signature_Source"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Paper",
        "2": "FSA ID",
        "3": "FAA or EDE",
      }},
    ],
    note: [
        "1 = Paper",
        "2 = FSA ID",
        "3 = FAA or EDE",
        "Blank"
    ]};

export const field_289 = {len: 1, pos_start: 2802, pos_end: 2803,
    idx: 289, name: "Student Spouse Signature Source", path: ["student_spouse","Signature_Source"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Paper",
        "2": "FSA ID",
        "3": "FAA or EDE",
      }},
    ],
    note: [
        "1 = Paper",
        "2 = FSA ID",
        "3 = FAA or EDE",
        "Blank"
    ]};

export const field_290 = {len: 1, pos_start: 2803, pos_end: 2804,
    idx: 290, name: "Parent Signature Source", path: ["parent","Signature_Source"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Paper",
        "2": "FSA ID",
        "3": "FAA or EDE",
      }},
    ],
    note: [
        "1 = Paper",
        "2 = FSA ID",
        "3 = FAA or EDE",
        "Blank"
    ]};

export const field_291 = {len: 1, pos_start: 2804, pos_end: 2805,
    idx: 291, name: "Parent Spouse or Partner Signature Source", path: ["parent_spouse","Signature_Source"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Paper",
        "2": "FSA ID",
        "3": "FAA or EDE",
      }},
    ],
    note: [
        "1 = Paper",
        "2 = FSA ID",
        "3 = FAA or EDE",
        "Blank"
    ]};

export const field_292 = {len: 1, pos_start: 2805, pos_end: 2806,
    idx: 292, name: "Special Handling Indicator", path: ["Special_Handling_Indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "*": "Damaged Form",
        "@": "ED Special Handle Request",
        "D": "Applicant younger than 13 at startup",
        "C": "Incarcerated applicant",
        "": "No special handling required",
      }},
    ],
    note: [
        "* = Damaged Form",
        "@ = ED Special Handle Request",
        "D = Applicant younger than 13 at startup",
        "C = Incarcerated applicant",
        "Blank = No special handling required"
    ]};

export const field_293 = {len: 1, pos_start: 2806, pos_end: 2807,
    idx: 293, name: "Address Only Change Flag", path: ["Address_Only_Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Correction to student fields",
        "2": "Correction to student spouse fields",
        "3": "Correction to parent fields",
        "4": "Correction to parent spouse fields",
        "5": "Correction to student and contributor fields",
        "": "No change",
      }},
    ],
    note: [
        "1 = Correction to student fields",
        "2 = Correction to student spouse fields",
        "3 = Correction to parent fields",
        "4 = Correction to parent spouse fields",
        "5 = Correction to student and contributor fields",
        "Blank = No change"
    ]};

export const field_294 = {len: 1, pos_start: 2807, pos_end: 2808,
    idx: 294, name: "FPS Pushed ISIR Flag", path: ["FPS_Pushed_ISIR_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Transaction automatically sent to school",
        "": "Transaction not automatically sent to school",
      }},
    ],
    note: [
        "Y = Transaction automatically sent to school",
        "Blank = Transaction not automatically sent to school"
    ]};

export const field_295 = {len: 1, pos_start: 2808, pos_end: 2809,
    idx: 295, name: "Reject Status Change Flag", path: ["Reject_Status_Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Reject status has changed",
        "": "No change to reject status",
      }},
    ],
    note: [
        "Y = Reject status has changed",
        "Blank = No change to reject status"
    ]};

export const field_296 = {len: 2, pos_start: 2809, pos_end: 2811,
    idx: 296, name: "Verification Tracking Flag", path: ["Verification_Tracking_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "V1": "Standard Verification Group",
        "V2": "For Federal Student Aid use only",
        "V3": "For Federal Student Aid use only",
        "V4": "Custom Verification Group",
        "V5": "Aggregate Verification Group",
        "V6": "For Federal Student Aid Use only",
      }},
    ],
    note: [
        "V1 = Standard Verification Group",
        "V2 = For Federal Student Aid use only",
        "V3 = For Federal Student Aid use only",
        "V4 = Custom Verification Group",
        "V5 = Aggregate Verification Group",
        "V6 = For Federal Student Aid Use only",
        "Blank"
    ]};

export const field_297 = {len: 1, pos_start: 2811, pos_end: 2812,
    idx: 297, name: "Student Is Selected For Verification", path: ["student","Is_Selected_For_Verification"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "* = A subsequent transaction was selected for verification"
    ]};

export const field_298 = {len: 1, pos_start: 2812, pos_end: 2813,
    idx: 298, name: "Incarcerated Applicant Flag", path: ["Incarcerated_Applicant_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Correctional Facility Address File",
        "2": "Received via Incarcerated P.O. Box",
        "3": "Incarcerated Applicant Flag set by FAA",
        "4": "Incarcerated Applicant Flag removed by FAA",
      }},
    ],
    note: [
        "1 = Correctional Facility Address File",
        "2 = Received via Incarcerated P.O. Box",
        "3 = Incarcerated Applicant Flag set by FAA",
        "4 = Incarcerated Applicant Flag removed by FAA",
        "Blank"
    ]};

export const field_299 = {len: 2, pos_start: 2813, pos_end: 2815,
    idx: 299, name: "NSLDS Transaction Number", path: ["NSLDS_Transaction_Number"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"01","max":"99"},
    ],
    note: [
        "01 to 99",
        "Blank"
    ]};

export const field_300 = {len: 1, pos_start: 2815, pos_end: 2816,
    idx: 300, name: "NSLDS Database Results Flag", path: ["NSLDS_Database_Results_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Record matched, data sent",
        "2": "SSN match, no name or date of birth match, no data sent",
        "3": "SSN not found in NSLDS",
        "4": "Full match, no relevant data to send",
        "5": "Real-time transaction not sent to NSLDS",
        "": "Record not sent, all NSLDS fields will be blank",
      }},
    ],
    note: [
        "1 = Record matched, data sent",
        "2 = SSN match, no name or date of birth match, no data sent",
        "3 = SSN not found in NSLDS",
        "4 = Full match, no relevant data to send",
        "5 = Real-time transaction not sent to NSLDS",
        "Blank = Record not sent, all NSLDS fields will be blank"
    ]};

export const field_301 = {len: 1, pos_start: 2816, pos_end: 2817,
    idx: 301, name: "High School Flag", path: ["High_School_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Reported High School not found on valid high school file",
      }},
    ],
    note: [
        "Y = Reported High School not found on valid high school file",
        "Blank"
    ]};

export const field_302 = {len: 12, pos_start: 2817, pos_end: 2829,
    idx: 302, name: "Student Total Federal Work Study Earnings", path: ["student","Total_Federal_Work_Study_Earnings"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999999"},
    ],
    note: [
        "0 to 999999999999",
        "Blank"
    ]};

export const field_303 = {len: 12, pos_start: 2829, pos_end: 2841,
    idx: 303, name: "Student Spouse Total Federal Work Study Earnings", path: ["student_spouse","Total_Federal_Work_Study_Earnings"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999999"},
    ],
    note: [
        "0 to 999999999999",
        "Blank"
    ]};

export const field_304 = {len: 12, pos_start: 2841, pos_end: 2853,
    idx: 304, name: "Parent Total Federal Work Study Earnings", path: ["parent","Total_Federal_Work_Study_Earnings"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999999"},
    ],
    note: [
        "0 to 999999999999",
        "Blank"
    ]};

export const field_305 = {len: 12, pos_start: 2853, pos_end: 2865,
    idx: 305, name: "Parent Spouse or Partner Total Federal Work Study Earnings", path: ["parent_spouse","Total_Federal_Work_Study_Earnings"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999999"},
    ],
    note: [
        "0 to 999999999999",
        "Blank"
    ]};

export const field_306 = {len: 15, pos_start: 2865, pos_end: 2880,
    idx: 306, name: "Total Parent Allowances Against Income", path: ["parent","Total_Allowances_Against_Income"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999999999"},
    ],
    note: [
        "0 to 999999999999999",
        "Blank"
    ]};

export const field_307 = {len: 15, pos_start: 2880, pos_end: 2895,
    idx: 307, name: "Parent Payroll Tax Allowance", path: ["parent","Payroll_Tax_Allowance"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999999999"},
    ],
    note: [
        "0 to 999999999999999",
        "Blank"
    ]};

export const field_308 = {len: 15, pos_start: 2895, pos_end: 2910,
    idx: 308, name: "Parent Income Protection Allowance", alias: "IPA", path: ["parent","Income_Protection_Allowance"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999999999"},
    ],
    note: [
        "0 to 999999999999999",
        "Blank"
    ]};

export const field_309 = {len: 15, pos_start: 2910, pos_end: 2925,
    idx: 309, name: "Parent Employment Expense Allowance", alias: "PEEA", path: ["parent","Employment_Expense_Allowance"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999999999"},
    ],
    note: [
        "0 to 999999999999999",
        "Blank"
    ]};

export const field_310 = {len: 15, pos_start: 2925, pos_end: 2940,
    idx: 310, name: "Parent Available Income", alias: "PAI", path: ["parent","Available_Income"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-99999999999999","max":"999999999999999"},
    ],
    note: [
        "-99999999999999 to 999999999999999",
        "Blank"
    ]};

export const field_311 = {len: 15, pos_start: 2940, pos_end: 2955,
    idx: 311, name: "Parent Adjusted Available Income", alias: "PAAI", path: ["parent","Adjusted_Available_Income"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-99999999999999","max":"999999999999999"},
    ],
    note: [
        "-99999999999999 to 999999999999999",
        "Blank"
    ]};

export const field_312 = {len: 15, pos_start: 2955, pos_end: 2970,
    idx: 312, name: "Parent Contribution", alias: "PC", path: ["parent","Contribution"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-99999999999999","max":"999999999999999"},
    ],
    note: [
        "-99999999999999 to 999999999999999",
        "Blank"
    ]};

export const field_313 = {len: 15, pos_start: 2970, pos_end: 2985,
    idx: 313, name: "Student Payroll Tax Allowance", path: ["student","Payroll_Tax_Allowance"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999999999"},
    ],
    note: [
        "0 to 999999999999999",
        "Blank"
    ]};

export const field_314 = {len: 15, pos_start: 2985, pos_end: 3000,
    idx: 314, name: "Student Income Protection Allowance", alias: "IPA", path: ["student","Income_Protection_Allowance"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999999999"},
    ],
    note: [
        "0 to 999999999999999",
        "Blank"
    ]};

export const field_315 = {len: 15, pos_start: 3000, pos_end: 3015,
    idx: 315, name: "Student Allowance for Parents’ Negative Adjusted Available Income", path: ["student","Allowance_for_Parents_Negative_Adjusted_Available_Income"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999999999"},
    ],
    note: [
        "0 to 999999999999999",
        "Blank"
    ]};

export const field_316 = {len: 15, pos_start: 3015, pos_end: 3030,
    idx: 316, name: "Student Employment Expense Allowance", alias: "SEEA", path: ["student","Employment_Expense_Allowance"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999999999"},
    ],
    note: [
        "0 to 999999999999999",
        "Blank"
    ]};

export const field_317 = {len: 15, pos_start: 3030, pos_end: 3045,
    idx: 317, name: "Total Student Allowances Against Income", path: ["student","Total_Allowances_Against_Income"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999999999"},
    ],
    note: [
        "0 to 999999999999999",
        "Blank"
    ]};

export const field_318 = {len: 15, pos_start: 3045, pos_end: 3060,
    idx: 318, name: "Student Available Income (StAI)", path: ["student","Available_Income_StAI"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-99999999999999","max":"999999999999999"},
    ],
    note: [
        "-99999999999999 to 999999999999999",
        "Blank"
    ]};

export const field_319 = {len: 15, pos_start: 3060, pos_end: 3075,
    idx: 319, name: "Student Contribution from Income", alias: "SCI", path: ["student","Contribution_from_Income"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-99999999999999","max":"999999999999999"},
    ],
    note: [
        "-99999999999999 to 999999999999999",
        "Blank"
    ]};

export const field_320 = {len: 15, pos_start: 3075, pos_end: 3090,
    idx: 320, name: "Student Adjusted Available Income", alias: "SAAI", path: ["student","Adjusted_Available_Income"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-99999999999999","max":"999999999999999"},
    ],
    note: [
        "-99999999999999 to 999999999999999",
        "Blank"
    ]};

export const field_321 = {len: 15, pos_start: 3090, pos_end: 3105,
    idx: 321, name: "Total Student Contribution from SAAI", path: ["student","Total_Contribution_from_SAAI"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-1500","max":"999999999999999"},
    ],
    note: [
        "-1500 to 999999999999999",
        "Blank"
    ]};

export const field_322 = {len: 7, pos_start: 3105, pos_end: 3112,
    idx: 322, name: "Parent Discretionary Net Worth", alias: "PDNW", path: ["parent","Discretionary_Net_Worth"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"9999999"},
    ],
    note: [
        "0 to 9999999",
        "Blank"
    ]};

export const field_323 = {len: 7, pos_start: 3112, pos_end: 3119,
    idx: 323, name: "Parent Net Worth", alias: "PNW", path: ["parent","Net_Worth"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"9999999"},
    ],
    note: [
        "0 to 9999999",
        "Blank"
    ]};

export const field_324 = {len: 12, pos_start: 3119, pos_end: 3131,
    idx: 324, name: "Parent Asset Protection Allowance", alias: "PAPA", path: ["parent","Asset_Protection_Allowance"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999999"},
    ],
    note: [
        "0 to 999999999999",
        "Blank"
    ]};

export const field_325 = {len: 12, pos_start: 3131, pos_end: 3143,
    idx: 325, name: "Parent Contribution from Assets", alias: "PCA", path: ["parent","Contribution_from_Assets"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999999"},
    ],
    note: [
        "0 to 999999999999",
        "Blank"
    ]};

export const field_326 = {len: 7, pos_start: 3143, pos_end: 3150,
    idx: 326, name: "Student Net Worth", alias: "SNW", path: ["student","Net_Worth"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"9999999"},
    ],
    note: [
        "0 to 9999999",
        "Blank"
    ]};

export const field_327 = {len: 12, pos_start: 3150, pos_end: 3162,
    idx: 327, name: "Student Asset Protection Allowance", alias: "SAPA", path: ["student","Asset_Protection_Allowance"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999999"},
    ],
    note: [
        "0 to 999999999999",
        "Blank"
    ]};

export const field_328 = {len: 12, pos_start: 3162, pos_end: 3174,
    idx: 328, name: "Student Contribution from Assets", alias: "SCA", path: ["student","Contribution_from_Assets"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999999"},
    ],
    note: [
        "0 to 999999999999",
        "Blank"
    ]};

export const field_329 = {len: 3, pos_start: 3174, pos_end: 3177,
    idx: 329, name: "Assumed Student Family Size", path: ["student","Assumed_Family_Size"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"1","max":"198"},
    ],
    note: [
        "1 to 198",
        "Blank"
    ]};

export const field_330 = {len: 3, pos_start: 3177, pos_end: 3180,
    idx: 330, name: "Assumed Parent Family Size", path: ["parent","Assumed_Family_Size"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"1","max":"297"},
    ],
    note: [
        "1 to 297",
        "Blank"
    ]};


export const section_FPS = /* #__PURE__ */ {
    section: "FPS Processing Information",
    path: ["FPS"],
    field_list: [field_268, field_269, field_270, field_271, field_272, field_273, field_274, field_275, field_276, field_277, field_278, field_279, field_280, field_281, field_282, field_283, field_284, field_285, field_286, field_287, field_288, field_289, field_290, field_291, field_292, field_293, field_294, field_295, field_296, field_297, field_298, field_299, field_300, field_301, field_302, field_303, field_304, field_305, field_306, field_307, field_308, field_309, field_310, field_311, field_312, field_313, field_314, field_315, field_316, field_317, field_318, field_319, field_320, field_321, field_322, field_323, field_324, field_325, field_326, field_327, field_328, field_329, field_330],
}


//*********************************************
// Section: Correction, Highlight, and Verify Flags
//

export const field_331 = {len: 3, pos_start: 3180, pos_end: 3183,
    idx: 331, name: "Student First Name Correction, Highlight, and Verify flags", path: ["student","First_Name"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_332 = {len: 3, pos_start: 3183, pos_end: 3186,
    idx: 332, name: "Student Middle Name Correction, Highlight, and Verify flags", path: ["student","Middle_Name"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_333 = {len: 3, pos_start: 3186, pos_end: 3189,
    idx: 333, name: "Student Last Name Correction, Highlight, and Verify flags", path: ["student","Last_Name"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_334 = {len: 3, pos_start: 3189, pos_end: 3192,
    idx: 334, name: "Student Suffix Correction, Highlight, and Verify flags", path: ["student","Suffix"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_335 = {len: 3, pos_start: 3192, pos_end: 3195,
    idx: 335, name: "Student Date of Birth Correction, Highlight, and Verify flags", path: ["student","Date_of_Birth"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_336 = {len: 3, pos_start: 3195, pos_end: 3198,
    idx: 336, name: "Student Social Security Number Correction, Highlight, and Verify flags", path: ["student","Social_Security_Number"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_337 = {len: 3, pos_start: 3198, pos_end: 3201,
    idx: 337, name: "Student ITIN Correction, Highlight, and Verify flags", path: ["student","ITIN"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_338 = {len: 3, pos_start: 3201, pos_end: 3204,
    idx: 338, name: "Student Phone Number Correction, Highlight, and Verify flags", path: ["student","Phone_Number"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_339 = {len: 3, pos_start: 3204, pos_end: 3207,
    idx: 339, name: "Student Email Address Correction, Highlight, and Verify Flags", path: ["student","Email_Address"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_340 = {len: 3, pos_start: 3207, pos_end: 3210,
    idx: 340, name: "Student Street Address Correction, Highlight, and Verify Flags", path: ["student","Street_Address"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_341 = {len: 3, pos_start: 3210, pos_end: 3213,
    idx: 341, name: "Student City Correction, Highlight, and Verify Flags", path: ["student","City"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_342 = {len: 3, pos_start: 3213, pos_end: 3216,
    idx: 342, name: "Student State Correction, Highlight, and Verify Flags", path: ["student","State"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_343 = {len: 3, pos_start: 3216, pos_end: 3219,
    idx: 343, name: "Student Zip Code Correction, Highlight, and Verify Flags", path: ["student","Zip_Code"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_344 = {len: 3, pos_start: 3219, pos_end: 3222,
    idx: 344, name: "Student Country Correction, Highlight, and Verify Flags", path: ["student","Country"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_345 = {len: 3, pos_start: 3222, pos_end: 3225,
    idx: 345, name: "Student Marital Status Correction, Highlight, and Verify Flags", path: ["student","Marital_Status"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_346 = {len: 3, pos_start: 3225, pos_end: 3228,
    idx: 346, name: "Student Grade Level in College 2024–25 Correction, Highlight, and Verify Flags", path: ["student","Grade_Level_in_College"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_347 = {len: 3, pos_start: 3228, pos_end: 3231,
    idx: 347, name: "Student First Bachelor's Degree Before 2024 = 2025 School Year Correction, Highlight, and Verify Flags", path: ["student","First_Bachelors_Degree_Before_2024__2025_School_Year"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_348 = {len: 3, pos_start: 3231, pos_end: 3234,
    idx: 348, name: "Student Pursuing Teacher Certification? Correction, Highlight, and Verify Flags", path: ["student","Pursuing_Teacher_Certification"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_349 = {len: 3, pos_start: 3234, pos_end: 3237,
    idx: 349, name: "Student Active Duty? Correction, Highlight, and Verify Flags", path: ["student","Active_Duty"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_350 = {len: 3, pos_start: 3237, pos_end: 3240,
    idx: 350, name: "Student Veteran? Correction, Highlight, and Verify Flags", path: ["student","Veteran"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_351 = {len: 3, pos_start: 3240, pos_end: 3243,
    idx: 351, name: "Student Child or Other Dependents? Correction, Highlight, and Verify Flags", path: ["student","Child_or_Other_Dependents"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_352 = {len: 3, pos_start: 3243, pos_end: 3246,
    idx: 352, name: "Student Parents Deceased? Correction, Highlight, and Verify Flags", path: ["student","Parents_Deceased"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_353 = {len: 3, pos_start: 3246, pos_end: 3249,
    idx: 353, name: "Student Ward of Court? Correction, Highlight, and Verify Flags", path: ["student","Ward_of_Court"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_354 = {len: 3, pos_start: 3249, pos_end: 3252,
    idx: 354, name: "Student In Foster Care? Correction, Highlight, and Verify Flags", path: ["student","In_Foster_Care"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_355 = {len: 3, pos_start: 3252, pos_end: 3255,
    idx: 355, name: "Student Emancipated Minor? Correction, Highlight, and Verify Flags", path: ["student","Emancipated_Minor"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_356 = {len: 3, pos_start: 3255, pos_end: 3258,
    idx: 356, name: "Student Legal Guardianship? Correction, Highlight, and Verify Flags", path: ["student","Legal_Guardianship"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_357 = {len: 3, pos_start: 3258, pos_end: 3261,
    idx: 357, name: "Student None of the above (Personal Circumstances) Correction, Highlight, and Verify Flags", path: ["student","None_of_the_above_Personal_Circumstances"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_358 = {len: 3, pos_start: 3261, pos_end: 3264,
    idx: 358, name: "Student Unaccompanied Homeless Youth, or is Unaccompanied, At Risk of Homelessness, and Self-Supporting? Correction, Highlight, and Verify Flags", path: ["student","Unaccompanied_Homeless_Youth_or_is_Unaccompanied_At_Risk_of_Homelessness_and_Self_Supporting"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_359 = {len: 3, pos_start: 3264, pos_end: 3267,
    idx: 359, name: "Student Unaccompanied and Homeless (General)? Correction, Highlight, and Verify Flags", path: ["student","Unaccompanied_and_Homeless_General"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_360 = {len: 3, pos_start: 3267, pos_end: 3270,
    idx: 360, name: "Student Unaccompanied and Homeless (HS)? Correction, Highlight, and Verify Flags", path: ["student","Unaccompanied_and_Homeless_HS"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_361 = {len: 3, pos_start: 3270, pos_end: 3273,
    idx: 361, name: "Student Unaccompanied and Homeless (TRIO)? Correction, Highlight, and Verify Flags", path: ["student","Unaccompanied_and_Homeless_TRIO"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_362 = {len: 3, pos_start: 3273, pos_end: 3276,
    idx: 362, name: "Student Unaccompanied and Homeless (FAA)? Correction, Highlight, and Verify Flags", path: ["student","Unaccompanied_and_Homeless_FAA"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_363 = {len: 3, pos_start: 3276, pos_end: 3279,
    idx: 363, name: "Student None of the above (Other Circumstances) Correction, Highlight, and Verify Flags", path: ["student","None_of_the_above_Other_Circumstances"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_364 = {len: 3, pos_start: 3279, pos_end: 3282,
    idx: 364, name: "Student Has Unusual Circumstance Correction, Highlight, and Verify Flags", path: ["student","Has_Unusual_Circumstance"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_365 = {len: 3, pos_start: 3282, pos_end: 3285,
    idx: 365, name: "Student Unsub Only Correction, Highlight, and Verify Flags", path: ["student","Unsub_Only"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_366 = {len: 3, pos_start: 3285, pos_end: 3288,
    idx: 366, name: "Student Updated Family Size Correction, Highlight, and Verify Flags", path: ["student","Updated_Family_Size"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_367 = {len: 3, pos_start: 3288, pos_end: 3291,
    idx: 367, name: "Student Number in College Correction, Highlight, and Verify Flags", path: ["student","Number_in_College"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_368 = {len: 3, pos_start: 3291, pos_end: 3294,
    idx: 368, name: "Student Citizenship Status Correction, Highlight, and Verify Flags", path: ["student","Citizenship_Status"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_369 = {len: 3, pos_start: 3294, pos_end: 3297,
    idx: 369, name: "Student A-Number Correction, Highlight, and Verify Flags", path: ["student","A_Number"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_370 = {len: 3, pos_start: 3297, pos_end: 3300,
    idx: 370, name: "Student State of Legal Residence Correction, Highlight, and Verify Flags", path: ["student","State_of_Legal_Residence"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_371 = {len: 3, pos_start: 3300, pos_end: 3303,
    idx: 371, name: "Student Legal Residence Date Correction, Highlight, and Verify Flags", path: ["student","Legal_Residence_Date"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_372 = {len: 3, pos_start: 3303, pos_end: 3306,
    idx: 372, name: "Student Either Parent Attend College Correction, Highlight, and Verify Flags", path: ["student","Either_Parent_Attend_College"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_373 = {len: 3, pos_start: 3306, pos_end: 3309,
    idx: 373, name: "Student Parent Killed in the Line of Duty Correction, Highlight, and Verify Flags", path: ["student","Parent_Killed_in_the_Line_of_Duty"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_374 = {len: 3, pos_start: 3309, pos_end: 3312,
    idx: 374, name: "Student High School Completion Status Correction, Highlight, and Verify Flags", path: ["student","High_School_Completion_Status"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_375 = {len: 3, pos_start: 3312, pos_end: 3315,
    idx: 375, name: "Student High School Name Correction, Highlight, and Verify Flags", path: ["student","High_School_Name"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_376 = {len: 3, pos_start: 3315, pos_end: 3318,
    idx: 376, name: "Student High School City Correction, Highlight, and Verify Flags", path: ["student","High_School_City"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_377 = {len: 3, pos_start: 3318, pos_end: 3321,
    idx: 377, name: "Student High School State Correction, Highlight, and Verify Flags", path: ["student","High_School_State"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_378 = {len: 3, pos_start: 3321, pos_end: 3324,
    idx: 378, name: "Student High School Equivalent Diploma Name Correction, Highlight, and Verify Flags", path: ["student","High_School_Equivalent_Diploma_Name"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_379 = {len: 3, pos_start: 3324, pos_end: 3327,
    idx: 379, name: "Student High School Equivalent Diploma State Correction, Highlight, and Verify Flags", path: ["student","High_School_Equivalent_Diploma_State"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_380 = {len: 3, pos_start: 3327, pos_end: 3330,
    idx: 380, name: "Student Received EITC? Correction, Highlight, and Verify Flags", path: ["student","Received_EITC"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_381 = {len: 3, pos_start: 3330, pos_end: 3333,
    idx: 381, name: "Student Received Federal Housing Assistance? Correction, Highlight, and Verify Flags", path: ["student","Received_Federal_Housing_Assistance"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_382 = {len: 3, pos_start: 3333, pos_end: 3336,
    idx: 382, name: "Student Received Free/Reduced Price Lunch? Correction, Highlight, and Verify Flags", path: ["student","Received_FreeReduced_Price_Lunch"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_383 = {len: 3, pos_start: 3336, pos_end: 3339,
    idx: 383, name: "Student Received Medicaid? Correction, Highlight, and Verify Flags", path: ["student","Received_Medicaid"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_384 = {len: 3, pos_start: 3339, pos_end: 3342,
    idx: 384, name: "Student Received Refundable Credit for 36B Health Plan? Correction, Highlight, and Verify Flags", path: ["student","Received_Refundable_Credit_for_36B_Health_Plan"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_385 = {len: 3, pos_start: 3342, pos_end: 3345,
    idx: 385, name: "Student Received SNAP? Correction, Highlight, and Verify Flags", path: ["student","Received_SNAP"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_386 = {len: 3, pos_start: 3345, pos_end: 3348,
    idx: 386, name: "Student Received Supplemental Security Income? Correction, Highlight, and Verify Flags", path: ["student","Received_Supplemental_Security_Income"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_387 = {len: 3, pos_start: 3348, pos_end: 3351,
    idx: 387, name: "Student Received TANF? Correction, Highlight, and Verify Flags", path: ["student","Received_TANF"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_388 = {len: 3, pos_start: 3351, pos_end: 3354,
    idx: 388, name: "Student Received WIC? Correction, Highlight, and Verify Flags", path: ["student","Received_WIC"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_389 = {len: 3, pos_start: 3354, pos_end: 3357,
    idx: 389, name: "Student None of the above (Federal Benefits) Correction, Highlight, and Verify Flags", path: ["student","None_of_the_above_Federal_Benefits"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_390 = {len: 3, pos_start: 3357, pos_end: 3360,
    idx: 390, name: "Student Filed 1040 or 1040NR? Correction, Highlight, and Verify Flags", path: ["student","Filed_1040_or_1040NR"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_391 = {len: 3, pos_start: 3360, pos_end: 3363,
    idx: 391, name: "Student Filed Non-U.S. Tax Return? Correction, Highlight, and Verify Flags", path: ["student","Filed_Non_US_Tax_Return"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_392 = {len: 3, pos_start: 3363, pos_end: 3366,
    idx: 392, name: "Student Filed Joint Return With Current Spouse? Correction, Highlight, and Verify Flags", path: ["student","Filed_Joint_Return_With_Current_Spouse"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_393 = {len: 3, pos_start: 3366, pos_end: 3369,
    idx: 393, name: "Student Tax Return Filing Status Correction, Highlight, and Verify Flags", path: ["student","Tax_Return_Filing_Status"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_394 = {len: 3, pos_start: 3369, pos_end: 3372,
    idx: 394, name: "Student Income Earned from Work Correction, Highlight, and Verify Flags", path: ["student","Income_Earned_from_Work"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_395 = {len: 3, pos_start: 3372, pos_end: 3375,
    idx: 395, name: "Student Tax Exempt Interest Income Correction, Highlight, and Verify Flags", path: ["student","Tax_Exempt_Interest_Income"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_396 = {len: 3, pos_start: 3375, pos_end: 3378,
    idx: 396, name: "Student Untaxed Portions of IRA Distributions Correction, Highlight, and Verify Flags", path: ["student","Untaxed_Portions_of_IRA_Distributions"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_397 = {len: 3, pos_start: 3378, pos_end: 3381,
    idx: 397, name: "Student IRA Rollover Correction, Highlight, and Verify Flags", path: ["student","IRA_Rollover"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_398 = {len: 3, pos_start: 3381, pos_end: 3384,
    idx: 398, name: "Student Untaxed Portions of Pensions Correction, Highlight, and Verify Flags", path: ["student","Untaxed_Portions_of_Pensions"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_399 = {len: 3, pos_start: 3384, pos_end: 3387,
    idx: 399, name: "Student Pension Rollover Correction, Highlight, and Verify Flags", path: ["student","Pension_Rollover"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_400 = {len: 3, pos_start: 3387, pos_end: 3390,
    idx: 400, name: "Student Adjusted Gross Income Correction, Highlight, and Verify Flags", path: ["student","Adjusted_Gross_Income"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_401 = {len: 3, pos_start: 3390, pos_end: 3393,
    idx: 401, name: "Student Income Tax Paid Correction, Highlight, and Verify Flags", path: ["student","Income_Tax_Paid"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_402 = {len: 3, pos_start: 3393, pos_end: 3396,
    idx: 402, name: "Student Earned Income Tax Credit Received During Tax Year? Correction, Highlight, and Verify Flags", path: ["student","Earned_Income_Tax_Credit_Received_During_Tax_Year"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_403 = {len: 3, pos_start: 3396, pos_end: 3399,
    idx: 403, name: "Student Deductible Payments to IRA, Keogh, Other Correction, Highlight, and Verify Flags", path: ["student","Deductible_Payments_to_IRA_Keogh_Other"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_404 = {len: 3, pos_start: 3399, pos_end: 3402,
    idx: 404, name: "Student Education Credits Correction, Highlight, and Verify Flags", path: ["student","Education_Credits"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_405 = {len: 3, pos_start: 3402, pos_end: 3405,
    idx: 405, name: "Student Filed Schedule A, B, D, E, F or H? Correction, Highlight, and Verify Flags", path: ["student","Filed_Schedule_A_B_D_E_F_or_H"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_406 = {len: 3, pos_start: 3405, pos_end: 3408,
    idx: 406, name: "Student Schedule C Amount Correction, Highlight, and Verify Flags", path: ["student","Schedule_C_Amount"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_407 = {len: 3, pos_start: 3408, pos_end: 3411,
    idx: 407, name: "Student College Grant and Scholarship Aid Correction, Highlight, and Verify Flags", path: ["student","College_Grant_and_Scholarship_Aid"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_408 = {len: 3, pos_start: 3411, pos_end: 3414,
    idx: 408, name: "Student Foreign Earned Income Exclusion Correction, Highlight, and Verify Flags", path: ["student","Foreign_Earned_Income_Exclusion"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_409 = {len: 3, pos_start: 3414, pos_end: 3417,
    idx: 409, name: "Student Child Support Received Correction, Highlight, and Verify Flags", path: ["student","Child_Support_Received"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_410 = {len: 3, pos_start: 3417, pos_end: 3420,
    idx: 410, name: "Student Net Worth of Businesses and Investment Farms Correction, Highlight, and Verify Flags", path: ["student","Net_Worth_of_Businesses_and_Investment_Farms"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_411 = {len: 3, pos_start: 3420, pos_end: 3423,
    idx: 411, name: "Student Net Worth of Current Investments Correction, Highlight, and Verify Flags", path: ["student","Net_Worth_of_Current_Investments"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_412 = {len: 3, pos_start: 3423, pos_end: 3426,
    idx: 412, name: "Student Total of Cash, Savings, and Checking Accounts Correction, Highlight, and Verify Flags", path: ["student","Total_of_Cash_Savings_and_Checking_Accounts"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_413 = {len: 3, pos_start: 3426, pos_end: 3429,
    idx: 413, name: "Student College #1 Correction, Highlight, and Verify Flags", path: ["student","College_1"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_414 = {len: 3, pos_start: 3429, pos_end: 3432,
    idx: 414, name: "Student College #2 Correction, Highlight, and Verify Flags", path: ["student","College_2"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_415 = {len: 3, pos_start: 3432, pos_end: 3435,
    idx: 415, name: "Student College #3 Correction, Highlight, and Verify Flags", path: ["student","College_3"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_416 = {len: 3, pos_start: 3435, pos_end: 3438,
    idx: 416, name: "Student College #4 Correction, Highlight, and Verify Flags", path: ["student","College_4"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_417 = {len: 3, pos_start: 3438, pos_end: 3441,
    idx: 417, name: "Student College #5 Correction, Highlight, and Verify Flags", path: ["student","College_5"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_418 = {len: 3, pos_start: 3441, pos_end: 3444,
    idx: 418, name: "Student College #6 Correction, Highlight, and Verify Flags", path: ["student","College_6"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_419 = {len: 3, pos_start: 3444, pos_end: 3447,
    idx: 419, name: "Student College #7 Correction, Highlight, and Verify Flags", path: ["student","College_7"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_420 = {len: 3, pos_start: 3447, pos_end: 3450,
    idx: 420, name: "Student College #8 Correction, Highlight, and Verify Flags", path: ["student","College_8"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_421 = {len: 3, pos_start: 3450, pos_end: 3453,
    idx: 421, name: "Student College #9 Correction, Highlight, and Verify Flags", path: ["student","College_9"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_422 = {len: 3, pos_start: 3453, pos_end: 3456,
    idx: 422, name: "Student College #10 Correction, Highlight, and Verify Flags", path: ["student","College_10"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_423 = {len: 3, pos_start: 3456, pos_end: 3459,
    idx: 423, name: "Student College #11 Correction, Highlight, and Verify Flags", path: ["student","College_11"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_424 = {len: 3, pos_start: 3459, pos_end: 3462,
    idx: 424, name: "Student College #12 Correction, Highlight, and Verify Flags", path: ["student","College_12"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_425 = {len: 3, pos_start: 3462, pos_end: 3465,
    idx: 425, name: "Student College #13 Correction, Highlight, and Verify Flags", path: ["student","College_13"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_426 = {len: 3, pos_start: 3465, pos_end: 3468,
    idx: 426, name: "Student College #14 Correction, Highlight, and Verify Flags", path: ["student","College_14"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_427 = {len: 3, pos_start: 3468, pos_end: 3471,
    idx: 427, name: "Student College #15 Correction, Highlight, and Verify Flags", path: ["student","College_15"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_428 = {len: 3, pos_start: 3471, pos_end: 3474,
    idx: 428, name: "Student College #16 Correction, Highlight, and Verify Flags", path: ["student","College_16"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_429 = {len: 3, pos_start: 3474, pos_end: 3477,
    idx: 429, name: "Student College #17 Correction, Highlight, and Verify Flags", path: ["student","College_17"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_430 = {len: 3, pos_start: 3477, pos_end: 3480,
    idx: 430, name: "Student College #18 Correction, Highlight, and Verify Flags", path: ["student","College_18"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_431 = {len: 3, pos_start: 3480, pos_end: 3483,
    idx: 431, name: "Student College #19 Correction, Highlight, and Verify Flags", path: ["student","College_19"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_432 = {len: 3, pos_start: 3483, pos_end: 3486,
    idx: 432, name: "Student College #20 Correction, Highlight, and Verify Flags", path: ["student","College_20"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_433 = {len: 3, pos_start: 3486, pos_end: 3489,
    idx: 433, name: "Student Consent to Retrieve and Disclose FTI Correction, Highlight, and Verify Flags", path: ["student","Consent_to_Retrieve_and_Disclose_FTI"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_434 = {len: 3, pos_start: 3489, pos_end: 3492,
    idx: 434, name: "Student Signature Correction, Highlight, and Verify Flags", path: ["student","Signature"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_435 = {len: 3, pos_start: 3492, pos_end: 3495,
    idx: 435, name: "Student Signature Date Correction, Highlight, and Verify Flags", path: ["student","Signature_Date"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_436 = {len: 3, pos_start: 3495, pos_end: 3498,
    idx: 436, name: "Student Spouse First Name Correction, Highlight, and Verify Flags", path: ["student_spouse","First_Name"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_437 = {len: 3, pos_start: 3498, pos_end: 3501,
    idx: 437, name: "Student Spouse Middle Name Correction, Highlight, and Verify Flags", path: ["student_spouse","Middle_Name"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_438 = {len: 3, pos_start: 3501, pos_end: 3504,
    idx: 438, name: "Student Spouse Last Name Correction, Highlight, and Verify Flags", path: ["student_spouse","Last_Name"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_439 = {len: 3, pos_start: 3504, pos_end: 3507,
    idx: 439, name: "Student Spouse Suffix Correction, Highlight, and Verify Flags", path: ["student_spouse","Suffix"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_440 = {len: 3, pos_start: 3507, pos_end: 3510,
    idx: 440, name: "Student Spouse Date of Birth Correction, Highlight, and Verify Flags", path: ["student_spouse","Date_of_Birth"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_441 = {len: 3, pos_start: 3510, pos_end: 3513,
    idx: 441, name: "Student Spouse Social Security Number Correction, Highlight, and Verify Flags", path: ["student_spouse","Social_Security_Number"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_442 = {len: 3, pos_start: 3513, pos_end: 3516,
    idx: 442, name: "Student Spouse ITIN Correction, Highlight, and Verify Flags", path: ["student_spouse","ITIN"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_443 = {len: 3, pos_start: 3516, pos_end: 3519,
    idx: 443, name: "Student Spouse Phone Number Correction, Highlight, and Verify Flags", path: ["student_spouse","Phone_Number"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_444 = {len: 3, pos_start: 3519, pos_end: 3522,
    idx: 444, name: "Student Spouse Email Address Correction, Highlight, and Verify Flags", path: ["student_spouse","Email_Address"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_445 = {len: 3, pos_start: 3522, pos_end: 3525,
    idx: 445, name: "Student Spouse Street Address Correction, Highlight, and Verify Flags", path: ["student_spouse","Street_Address"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_446 = {len: 3, pos_start: 3525, pos_end: 3528,
    idx: 446, name: "Student Spouse City Correction, Highlight, and Verify Flags", path: ["student_spouse","City"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_447 = {len: 3, pos_start: 3528, pos_end: 3531,
    idx: 447, name: "Student Spouse State Correction, Highlight, and Verify Flags", path: ["student_spouse","State"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_448 = {len: 3, pos_start: 3531, pos_end: 3534,
    idx: 448, name: "Student Spouse Zip Code Correction, Highlight, and Verify Flags", path: ["student_spouse","Zip_Code"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_449 = {len: 3, pos_start: 3534, pos_end: 3537,
    idx: 449, name: "Student Spouse Country Correction, Highlight, and Verify Flags", path: ["student_spouse","Country"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_450 = {len: 3, pos_start: 3537, pos_end: 3540,
    idx: 450, name: "Student Spouse Filed 1040 or 1040NR? Correction, Highlight, and Verify Flags", path: ["student_spouse","Filed_1040_or_1040NR"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_451 = {len: 3, pos_start: 3540, pos_end: 3543,
    idx: 451, name: "Student Spouse Filed non-U.S. tax return? Correction, Highlight, and Verify Flags", path: ["student_spouse","Filed_non_US_tax_return"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_452 = {len: 3, pos_start: 3543, pos_end: 3546,
    idx: 452, name: "Student Spouse Tax Return Filing Status Correction, Highlight, and Verify Flags", path: ["student_spouse","Tax_Return_Filing_Status"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_453 = {len: 3, pos_start: 3546, pos_end: 3549,
    idx: 453, name: "Student Spouse Income Earned from Work Correction, Highlight, and Verify Flags", path: ["student_spouse","Income_Earned_from_Work"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_454 = {len: 3, pos_start: 3549, pos_end: 3552,
    idx: 454, name: "Student Spouse Tax Exempt Interest Income Correction, Highlight, and Verify Flags", path: ["student_spouse","Tax_Exempt_Interest_Income"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_455 = {len: 3, pos_start: 3552, pos_end: 3555,
    idx: 455, name: "Student Spouse Untaxed Portions of IRA Distributions Correction, Highlight, and Verify Flags", path: ["student_spouse","Untaxed_Portions_of_IRA_Distributions"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_456 = {len: 3, pos_start: 3555, pos_end: 3558,
    idx: 456, name: "Student Spouse IRA Rollover Correction, Highlight, and Verify Flags", path: ["student_spouse","IRA_Rollover"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_457 = {len: 3, pos_start: 3558, pos_end: 3561,
    idx: 457, name: "Student Spouse Untaxed Portions of Pensions Correction, Highlight, and Verify Flags", path: ["student_spouse","Untaxed_Portions_of_Pensions"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_458 = {len: 3, pos_start: 3561, pos_end: 3564,
    idx: 458, name: "Student Spouse Pension Rollover Correction, Highlight, and Verify Flags", path: ["student_spouse","Pension_Rollover"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_459 = {len: 3, pos_start: 3564, pos_end: 3567,
    idx: 459, name: "Student Spouse Adjusted Gross Income Correction, Highlight, and Verify Flags", path: ["student_spouse","Adjusted_Gross_Income"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_460 = {len: 3, pos_start: 3567, pos_end: 3570,
    idx: 460, name: "Student Spouse Income Tax Paid Correction, Highlight, and Verify Flags", path: ["student_spouse","Income_Tax_Paid"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_461 = {len: 3, pos_start: 3570, pos_end: 3573,
    idx: 461, name: "Student Spouse Deductible Payments to IRA, Keogh, Other Correction, Highlight, and Verify Flags", path: ["student_spouse","Deductible_Payments_to_IRA_Keogh_Other"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_462 = {len: 3, pos_start: 3573, pos_end: 3576,
    idx: 462, name: "Student Spouse Education Credits Correction, Highlight, and Verify Flags", path: ["student_spouse","Education_Credits"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_463 = {len: 3, pos_start: 3576, pos_end: 3579,
    idx: 463, name: "Student Spouse Filed Schedule A, B, D, E, F or H? Correction, Highlight, and Verify Flags", path: ["student_spouse","Filed_Schedule_A_B_D_E_F_or_H"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_464 = {len: 3, pos_start: 3579, pos_end: 3582,
    idx: 464, name: "Student Spouse Schedule C Amount Correction, Highlight, and Verify Flags", path: ["student_spouse","Schedule_C_Amount"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_465 = {len: 3, pos_start: 3582, pos_end: 3585,
    idx: 465, name: "Student Spouse Foreign Income Exempt from Federal Taxation Correction, Highlight, and Verify Flags", path: ["student_spouse","Foreign_Income_Exempt_from_Federal_Taxation"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_466 = {len: 3, pos_start: 3585, pos_end: 3588,
    idx: 466, name: "Student Spouse Consent to Retrieve and Disclose FTI Correction, Highlight, and Verify Flags", path: ["student_spouse","Consent_to_Retrieve_and_Disclose_FTI"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_467 = {len: 3, pos_start: 3588, pos_end: 3591,
    idx: 467, name: "Student Spouse Signature Correction, Highlight, and Verify Flags", path: ["student_spouse","Signature"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_468 = {len: 3, pos_start: 3591, pos_end: 3594,
    idx: 468, name: "Student Spouse Signature Date Correction, Highlight, and Verify Flags", path: ["student_spouse","Signature_Date"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_469 = {len: 3, pos_start: 3594, pos_end: 3597,
    idx: 469, name: "Parent First Name Correction, Highlight, and Verify Flags", path: ["parent","First_Name"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_470 = {len: 3, pos_start: 3597, pos_end: 3600,
    idx: 470, name: "Parent Middle Name Correction, Highlight, and Verify Flags", path: ["parent","Middle_Name"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_471 = {len: 3, pos_start: 3600, pos_end: 3603,
    idx: 471, name: "Parent Last Name Correction, Highlight, and Verify Flags", path: ["parent","Last_Name"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_472 = {len: 3, pos_start: 3603, pos_end: 3606,
    idx: 472, name: "Parent Suffix Correction, Highlight, and Verify Flags", path: ["parent","Suffix"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_473 = {len: 3, pos_start: 3606, pos_end: 3609,
    idx: 473, name: "Parent Date of Birth Correction, Highlight, and Verify Flags", path: ["parent","Date_of_Birth"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_474 = {len: 3, pos_start: 3609, pos_end: 3612,
    idx: 474, name: "Parent Social Security Number Correction, Highlight, and Verify Flags", path: ["parent","Social_Security_Number"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_475 = {len: 3, pos_start: 3612, pos_end: 3615,
    idx: 475, name: "Parent ITIN Correction, Highlight, and Verify Flags", path: ["parent","ITIN"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_476 = {len: 3, pos_start: 3615, pos_end: 3618,
    idx: 476, name: "Parent Phone Number Correction, Highlight, and Verify Flags", path: ["parent","Phone_Number"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_477 = {len: 3, pos_start: 3618, pos_end: 3621,
    idx: 477, name: "Parent Email Address Correction, Highlight, and Verify Flags", path: ["parent","Email_Address"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_478 = {len: 3, pos_start: 3621, pos_end: 3624,
    idx: 478, name: "Parent Street Address Correction, Highlight, and Verify Flags", path: ["parent","Street_Address"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_479 = {len: 3, pos_start: 3624, pos_end: 3627,
    idx: 479, name: "Parent City Correction, Highlight, and Verify Flags", path: ["parent","City"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_480 = {len: 3, pos_start: 3627, pos_end: 3630,
    idx: 480, name: "Parent State Correction, Highlight, and Verify Flags", path: ["parent","State"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_481 = {len: 3, pos_start: 3630, pos_end: 3633,
    idx: 481, name: "Parent Zip Code Correction, Highlight, and Verify Flags", path: ["parent","Zip_Code"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_482 = {len: 3, pos_start: 3633, pos_end: 3636,
    idx: 482, name: "Parent Country Correction, Highlight, and Verify Flags", path: ["parent","Country"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_483 = {len: 3, pos_start: 3636, pos_end: 3639,
    idx: 483, name: "Parent Marital Status Correction, Highlight, and Verify Flags", path: ["parent","Marital_Status"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_484 = {len: 3, pos_start: 3639, pos_end: 3642,
    idx: 484, name: "Parent State of Legal Residence Correction, Highlight, and Verify Flags", path: ["parent","State_of_Legal_Residence"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_485 = {len: 3, pos_start: 3642, pos_end: 3645,
    idx: 485, name: "Parent Legal Residence Date Correction, Highlight, and Verify Flags", path: ["parent","Legal_Residence_Date"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_486 = {len: 3, pos_start: 3645, pos_end: 3648,
    idx: 486, name: "Parent Updated Family Size Correction, Highlight, and Verify Flags", path: ["parent","Updated_Family_Size"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_487 = {len: 3, pos_start: 3648, pos_end: 3651,
    idx: 487, name: "Parent Number in College Correction, Highlight, and Verify Flags", path: ["parent","Number_in_College"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_488 = {len: 3, pos_start: 3651, pos_end: 3654,
    idx: 488, name: "Parent Received EITC? Correction, Highlight, and Verify Flags", path: ["parent","Received_EITC"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_489 = {len: 3, pos_start: 3654, pos_end: 3657,
    idx: 489, name: "Parent Received Federal Housing Assistance? Correction, Highlight, and Verify Flags", path: ["parent","Received_Federal_Housing_Assistance"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_490 = {len: 3, pos_start: 3657, pos_end: 3660,
    idx: 490, name: "Parent Received Free/Reduced Price Lunch? Correction, Highlight, and Verify Flags", path: ["parent","Received_FreeReduced_Price_Lunch"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_491 = {len: 3, pos_start: 3660, pos_end: 3663,
    idx: 491, name: "Parent Received Medicaid? Correction, Highlight, and Verify Flags", path: ["parent","Received_Medicaid"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_492 = {len: 3, pos_start: 3663, pos_end: 3666,
    idx: 492, name: "Parent Received Refundable Credit for 36B Health Plan? Correction, Highlight, and Verify Flags", path: ["parent","Received_Refundable_Credit_for_36B_Health_Plan"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_493 = {len: 3, pos_start: 3666, pos_end: 3669,
    idx: 493, name: "Parent Received SNAP? Correction, Highlight, and Verify Flags", path: ["parent","Received_SNAP"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_494 = {len: 3, pos_start: 3669, pos_end: 3672,
    idx: 494, name: "Parent Received Supplemental Security Income? Correction, Highlight, and Verify Flags", path: ["parent","Received_Supplemental_Security_Income"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_495 = {len: 3, pos_start: 3672, pos_end: 3675,
    idx: 495, name: "Parent Received TANF? Correction, Highlight, and Verify Flags", path: ["parent","Received_TANF"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_496 = {len: 3, pos_start: 3675, pos_end: 3678,
    idx: 496, name: "Parent Received WIC? Correction, Highlight, and Verify Flags", path: ["parent","Received_WIC"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_497 = {len: 3, pos_start: 3678, pos_end: 3681,
    idx: 497, name: "Parent None of the Above (Federal Benefits) Correction, Highlight, and Verify Flags", path: ["parent","None_of_the_Above_Federal_Benefits"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_498 = {len: 3, pos_start: 3681, pos_end: 3684,
    idx: 498, name: "Parent Filed 1040 or 1040NR? Correction, Highlight, and Verify Flags", path: ["parent","Filed_1040_or_1040NR"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_499 = {len: 3, pos_start: 3684, pos_end: 3687,
    idx: 499, name: "Parent Filed non-U.S. tax return? Correction, Highlight, and Verify Flags", path: ["parent","Filed_non_US_tax_return"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_500 = {len: 3, pos_start: 3687, pos_end: 3690,
    idx: 500, name: "Parent Filed Joint Return With Current Spouse? Correction, Highlight, and Verify Flags", path: ["parent","Filed_Joint_Return_With_Current_Spouse"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_501 = {len: 3, pos_start: 3690, pos_end: 3693,
    idx: 501, name: "Parent Tax Return Filing Status Correction, Highlight, and Verify Flags", path: ["parent","Tax_Return_Filing_Status"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_502 = {len: 3, pos_start: 3693, pos_end: 3696,
    idx: 502, name: "Parent Income Earned from Work Correction, Highlight, and Verify Flags", path: ["parent","Income_Earned_from_Work"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_503 = {len: 3, pos_start: 3696, pos_end: 3699,
    idx: 503, name: "Parent Tax Exempt Interest Income Correction, Highlight, and Verify Flags", path: ["parent","Tax_Exempt_Interest_Income"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_504 = {len: 3, pos_start: 3699, pos_end: 3702,
    idx: 504, name: "Parent Untaxed Portions of IRA Distributions Correction, Highlight, and Verify Flags", path: ["parent","Untaxed_Portions_of_IRA_Distributions"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_505 = {len: 3, pos_start: 3702, pos_end: 3705,
    idx: 505, name: "Parent IRA Rollover Correction, Highlight, and Verify Flags", path: ["parent","IRA_Rollover"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_506 = {len: 3, pos_start: 3705, pos_end: 3708,
    idx: 506, name: "Parent Untaxed Portions of Pensions Correction, Highlight, and Verify Flags", path: ["parent","Untaxed_Portions_of_Pensions"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_507 = {len: 3, pos_start: 3708, pos_end: 3711,
    idx: 507, name: "Parent Pension Rollover Correction, Highlight, and Verify Flags", path: ["parent","Pension_Rollover"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_508 = {len: 3, pos_start: 3711, pos_end: 3714,
    idx: 508, name: "Parent Adjusted Gross Income Correction, Highlight, and Verify Flags", path: ["parent","Adjusted_Gross_Income"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_509 = {len: 3, pos_start: 3714, pos_end: 3717,
    idx: 509, name: "Parent Income Tax Paid Correction, Highlight, and Verify Flags", path: ["parent","Income_Tax_Paid"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_510 = {len: 3, pos_start: 3717, pos_end: 3720,
    idx: 510, name: "Parent Earned Income Tax Credit Received During Tax Year? Correction, Highlight, and Verify Flags", path: ["parent","Earned_Income_Tax_Credit_Received_During_Tax_Year"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_511 = {len: 3, pos_start: 3720, pos_end: 3723,
    idx: 511, name: "Parent Deductible Payments to IRA, Keogh, Other Correction, Highlight, and Verify Flags", path: ["parent","Deductible_Payments_to_IRA_Keogh_Other"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_512 = {len: 3, pos_start: 3723, pos_end: 3726,
    idx: 512, name: "Parent Education Credits Correction, Highlight, and Verify Flags", path: ["parent","Education_Credits"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_513 = {len: 3, pos_start: 3726, pos_end: 3729,
    idx: 513, name: "Parent Filed Schedule A, B, D, E, F or H? Correction, Highlight, and Verify Flags", path: ["parent","Filed_Schedule_A_B_D_E_F_or_H"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_514 = {len: 3, pos_start: 3729, pos_end: 3732,
    idx: 514, name: "Parent Schedule C Amount Correction, Highlight, and Verify Flags", path: ["parent","Schedule_C_Amount"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_515 = {len: 3, pos_start: 3732, pos_end: 3735,
    idx: 515, name: "Parent College Grant and Scholarship Aid Correction, Highlight, and Verify Flags", path: ["parent","College_Grant_and_Scholarship_Aid"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_516 = {len: 3, pos_start: 3735, pos_end: 3738,
    idx: 516, name: "Parent Foreign Income Exempt from Federal Taxation Correction, Highlight, and Verify Flags", path: ["parent","Foreign_Income_Exempt_from_Federal_Taxation"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_517 = {len: 3, pos_start: 3738, pos_end: 3741,
    idx: 517, name: "Parent Child Support Received Correction, Highlight, and Verify Flags", path: ["parent","Child_Support_Received"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_518 = {len: 3, pos_start: 3741, pos_end: 3744,
    idx: 518, name: "Parent Net Worth of Current Investments Correction, Highlight, and Verify Flags", path: ["parent","Net_Worth_of_Current_Investments"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_519 = {len: 3, pos_start: 3744, pos_end: 3747,
    idx: 519, name: "Parent Total of Cash, Savings, and Checking Accounts Correction, Highlight, and Verify Flags", path: ["parent","Total_of_Cash_Savings_and_Checking_Accounts"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_520 = {len: 3, pos_start: 3747, pos_end: 3750,
    idx: 520, name: "Parent Net Worth of Businesses and Investment Farms Correction, Highlight, and Verify Flags", path: ["parent","Net_Worth_of_Businesses_and_Investment_Farms"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_521 = {len: 3, pos_start: 3750, pos_end: 3753,
    idx: 521, name: "Parent Consent to Retrieve and Disclose FTI Correction, Highlight, and Verify Flags", path: ["parent","Consent_to_Retrieve_and_Disclose_FTI"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_522 = {len: 3, pos_start: 3753, pos_end: 3756,
    idx: 522, name: "Parent Signature Correction, Highlight, and Verify Flags", path: ["parent","Signature"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_523 = {len: 3, pos_start: 3756, pos_end: 3759,
    idx: 523, name: "Parent Signature Date Correction, Highlight, and Verify Flags", path: ["parent","Signature_Date"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_524 = {len: 3, pos_start: 3759, pos_end: 3762,
    idx: 524, name: "Parent Spouse or Partner First Name Correction, Highlight, and Verify Flags", path: ["parent_spouse","First_Name"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_525 = {len: 3, pos_start: 3762, pos_end: 3765,
    idx: 525, name: "Parent Spouse or Partner Middle Name Correction, Highlight, and Verify Flags", path: ["parent_spouse","Middle_Name"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_526 = {len: 3, pos_start: 3765, pos_end: 3768,
    idx: 526, name: "Parent Spouse or Partner Last Name Correction, Highlight, and Verify Flags", path: ["parent_spouse","Last_Name"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_527 = {len: 3, pos_start: 3768, pos_end: 3771,
    idx: 527, name: "Parent Spouse or Partner Suffix Correction, Highlight, and Verify Flags", path: ["parent_spouse","Suffix"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_528 = {len: 3, pos_start: 3771, pos_end: 3774,
    idx: 528, name: "Parent Spouse or Partner Date of Birth Correction, Highlight, and Verify Flags", path: ["parent_spouse","Date_of_Birth"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_529 = {len: 3, pos_start: 3774, pos_end: 3777,
    idx: 529, name: "Parent Spouse or Partner Social Security Number Correction, Highlight, and Verify Flags", path: ["parent_spouse","Social_Security_Number"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_530 = {len: 3, pos_start: 3777, pos_end: 3780,
    idx: 530, name: "Parent Spouse or Partner ITIN Correction, Highlight, and Verify Flags", path: ["parent_spouse","ITIN"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_531 = {len: 3, pos_start: 3780, pos_end: 3783,
    idx: 531, name: "Parent Spouse or Partner Phone Number Correction, Highlight, and Verify Flags", path: ["parent_spouse","Phone_Number"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_532 = {len: 3, pos_start: 3783, pos_end: 3786,
    idx: 532, name: "Parent Spouse or Partner Email Address Correction, Highlight, and Verify Flags", path: ["parent_spouse","Email_Address"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_533 = {len: 3, pos_start: 3786, pos_end: 3789,
    idx: 533, name: "Parent Spouse or Partner Street Address Correction, Highlight, and Verify Flags", path: ["parent_spouse","Street_Address"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_534 = {len: 3, pos_start: 3789, pos_end: 3792,
    idx: 534, name: "Parent Spouse or Partner City Correction, Highlight, and Verify Flags", path: ["parent_spouse","City"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_535 = {len: 3, pos_start: 3792, pos_end: 3795,
    idx: 535, name: "Parent Spouse or Partner State Correction, Highlight, and Verify Flags", path: ["parent_spouse","State"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_536 = {len: 3, pos_start: 3795, pos_end: 3798,
    idx: 536, name: "Parent Spouse or Partner Zip Code Correction, Highlight, and Verify Flags", path: ["parent_spouse","Zip_Code"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_537 = {len: 3, pos_start: 3798, pos_end: 3801,
    idx: 537, name: "Parent Spouse or Partner Country Correction, Highlight, and Verify Flags", path: ["parent_spouse","Country"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_538 = {len: 3, pos_start: 3801, pos_end: 3804,
    idx: 538, name: "Parent Spouse or Partner Filed 1040 or 1040NR? Correction, Highlight, and Verify Flags", path: ["parent_spouse","Filed_1040_or_1040NR"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_539 = {len: 3, pos_start: 3804, pos_end: 3807,
    idx: 539, name: "Parent Spouse or Partner Filed non-U.S. tax return? Correction, Highlight, and Verify Flags", path: ["parent_spouse","Filed_non_US_tax_return"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_540 = {len: 3, pos_start: 3807, pos_end: 3810,
    idx: 540, name: "Parent Spouse or Partner Tax Return Filing Status Correction, Highlight, and Verify Flags", path: ["parent_spouse","Tax_Return_Filing_Status"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_541 = {len: 3, pos_start: 3810, pos_end: 3813,
    idx: 541, name: "Parent Spouse or Partner Income Earned from Work Correction, Highlight, and Verify Flags", path: ["parent_spouse","Income_Earned_from_Work"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_542 = {len: 3, pos_start: 3813, pos_end: 3816,
    idx: 542, name: "Parent Spouse or Partner Tax Exempt Interest Income Correction, Highlight, and Verify Flags", path: ["parent_spouse","Tax_Exempt_Interest_Income"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_543 = {len: 3, pos_start: 3816, pos_end: 3819,
    idx: 543, name: "Parent Spouse or Partner Untaxed Portions of IRA Distributions Correction, Highlight, and Verify Flags", path: ["parent_spouse","Untaxed_Portions_of_IRA_Distributions"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_544 = {len: 3, pos_start: 3819, pos_end: 3822,
    idx: 544, name: "Parent Spouse or Partner IRA Rollover Correction, Highlight, and Verify Flags", path: ["parent_spouse","IRA_Rollover"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_545 = {len: 3, pos_start: 3822, pos_end: 3825,
    idx: 545, name: "Parent Spouse or Partner Untaxed Portions of Pensions Correction, Highlight, and Verify Flags", path: ["parent_spouse","Untaxed_Portions_of_Pensions"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_546 = {len: 3, pos_start: 3825, pos_end: 3828,
    idx: 546, name: "Parent Spouse or Partner Pension Rollover Correction, Highlight, and Verify Flags", path: ["parent_spouse","Pension_Rollover"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_547 = {len: 3, pos_start: 3828, pos_end: 3831,
    idx: 547, name: "Parent Spouse or Partner Adjusted Gross Income Correction, Highlight, and Verify Flags", path: ["parent_spouse","Adjusted_Gross_Income"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_548 = {len: 3, pos_start: 3831, pos_end: 3834,
    idx: 548, name: "Parent Spouse or Partner Income Tax Paid Correction, Highlight, and Verify Flags", path: ["parent_spouse","Income_Tax_Paid"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_549 = {len: 3, pos_start: 3834, pos_end: 3837,
    idx: 549, name: "Parent Spouse or Partner Deductible Payments to IRA, Keogh, Other Correction, Highlight, and Verify Flags", path: ["parent_spouse","Deductible_Payments_to_IRA_Keogh_Other"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_550 = {len: 3, pos_start: 3837, pos_end: 3840,
    idx: 550, name: "Parent Spouse or Partner Education Credits Correction, Highlight, and Verify Flags", path: ["parent_spouse","Education_Credits"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_551 = {len: 3, pos_start: 3840, pos_end: 3843,
    idx: 551, name: "Parent Spouse or Partner Filed Schedule A, B, D, E, F or H? Correction, Highlight, and Verify Flags", path: ["parent_spouse","Filed_Schedule_A_B_D_E_F_or_H"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_552 = {len: 3, pos_start: 3843, pos_end: 3846,
    idx: 552, name: "Parent Spouse or Partner Schedule C Amount Correction, Highlight, and Verify Flags", path: ["parent_spouse","Schedule_C_Amount"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_553 = {len: 3, pos_start: 3846, pos_end: 3849,
    idx: 553, name: "Parent Spouse or Partner Foreign Income Exempt from Federal Taxation Correction, Highlight, and Verify Flags", path: ["parent_spouse","Foreign_Income_Exempt_from_Federal_Taxation"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_554 = {len: 3, pos_start: 3849, pos_end: 3852,
    idx: 554, name: "Parent Spouse or Partner Consent to Retrieve and Disclose FTI Correction, Highlight, and Verify Flags", path: ["parent_spouse","Consent_to_Retrieve_and_Disclose_FTI"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_555 = {len: 3, pos_start: 3852, pos_end: 3855,
    idx: 555, name: "Parent Spouse or Partner Signature Correction, Highlight, and Verify Flags", path: ["parent_spouse","Signature"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};

export const field_556 = {len: 3, pos_start: 3855, pos_end: 3858,
    idx: 556, name: "Parent Spouse or Partner Signature Date Correction, Highlight, and Verify Flags", path: ["parent_spouse","Signature_Date"], 
    validate: _validate_correction,
    "empty":"000",
    note: [
        "See description in the Correction, Highlight, and Verify Flags heading above."
    ]};


export const section_correction = /* #__PURE__ */ {
    section: "Correction, Highlight, and Verify Flags",
    path: ["correction"],
    field_list: [field_331, field_332, field_333, field_334, field_335, field_336, field_337, field_338, field_339, field_340, field_341, field_342, field_343, field_344, field_345, field_346, field_347, field_348, field_349, field_350, field_351, field_352, field_353, field_354, field_355, field_356, field_357, field_358, field_359, field_360, field_361, field_362, field_363, field_364, field_365, field_366, field_367, field_368, field_369, field_370, field_371, field_372, field_373, field_374, field_375, field_376, field_377, field_378, field_379, field_380, field_381, field_382, field_383, field_384, field_385, field_386, field_387, field_388, field_389, field_390, field_391, field_392, field_393, field_394, field_395, field_396, field_397, field_398, field_399, field_400, field_401, field_402, field_403, field_404, field_405, field_406, field_407, field_408, field_409, field_410, field_411, field_412, field_413, field_414, field_415, field_416, field_417, field_418, field_419, field_420, field_421, field_422, field_423, field_424, field_425, field_426, field_427, field_428, field_429, field_430, field_431, field_432, field_433, field_434, field_435, field_436, field_437, field_438, field_439, field_440, field_441, field_442, field_443, field_444, field_445, field_446, field_447, field_448, field_449, field_450, field_451, field_452, field_453, field_454, field_455, field_456, field_457, field_458, field_459, field_460, field_461, field_462, field_463, field_464, field_465, field_466, field_467, field_468, field_469, field_470, field_471, field_472, field_473, field_474, field_475, field_476, field_477, field_478, field_479, field_480, field_481, field_482, field_483, field_484, field_485, field_486, field_487, field_488, field_489, field_490, field_491, field_492, field_493, field_494, field_495, field_496, field_497, field_498, field_499, field_500, field_501, field_502, field_503, field_504, field_505, field_506, field_507, field_508, field_509, field_510, field_511, field_512, field_513, field_514, field_515, field_516, field_517, field_518, field_519, field_520, field_521, field_522, field_523, field_524, field_525, field_526, field_527, field_528, field_529, field_530, field_531, field_532, field_533, field_534, field_535, field_536, field_537, field_538, field_539, field_540, field_541, field_542, field_543, field_544, field_545, field_546, field_547, field_548, field_549, field_550, field_551, field_552, field_553, field_554, field_555, field_556],
}


//*********************************************
// Section: Matches and Other Processing Information
//

export const field_557 = {len: 1, pos_start: 3858, pos_end: 3859,
    idx: 557, name: "DHS Primary Match Status", path: ["DHS_Primary_Match_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Confirmed eligible noncitizen",
        "N": "Not confirmed eligible noncitizen",
        "P": "Pending",
        "D": "Duplicate Case",
        "I": "Invalid A-Number",
        "S": "Not sent",
        "": "Not needed",
      }},
    ],
    note: [
        "Y = Confirmed eligible noncitizen",
        "N = Not confirmed eligible noncitizen",
        "P = Pending",
        "D = Duplicate Case",
        "I = Invalid A-Number",
        "S = Not sent",
        "Blank = Not needed"
    ]};

export const field_558 = {len: 1, pos_start: 3859, pos_end: 3860,
    idx: 558, name: "DHS Secondary Match Status", path: ["DHS_Secondary_Match_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Confirmed Eligible Non-Citizen",
        "N": "Not Confirmed Eligible Non-Citizen",
        "P": "Pending",
        "C": "Continue to Process",
      }},
    ],
    note: [
        "Y = Confirmed Eligible Non-Citizen",
        "N = Not Confirmed Eligible Non-Citizen",
        "P = Pending",
        "C = Continue to Process",
        "Blank"
    ]};

export const field_559 = {len: 15, pos_start: 3860, pos_end: 3875,
    idx: 559, name: "DHS Case Number", path: ["DHS_Case_Number"], 
    validate: _validate_options,
    options: [
      {op: "dhs_case_number", },
    ],
    note: [
        "Format is 9999999999999XX; where 9 = Numerals 0 to 9, and",
        "X = Uppercase letters A to Z",
        "Blank"
    ]};

export const field_560 = {len: 1, pos_start: 3875, pos_end: 3876,
    idx: 560, name: "NSLDS Match Status", path: ["NSLDS_Match_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Eligible for Title IV Aid",
        "2": "Default",
        "3": "Overpayment",
        "4": "Default and overpayment",
        "5": "Processed in Realtime",
        "7": "Match and no data provided",
        "8": "Not sent",
      }},
    ],
    note: [
        "1 = Eligible for Title IV Aid",
        "2 = Default",
        "3 = Overpayment",
        "4 = Default and overpayment",
        "5 = Processed in Realtime",
        "7 = Match and no data provided",
        "8 = Not sent"
    ]};

export const field_561 = {len: 6, pos_start: 3876, pos_end: 3882,
    idx: 561, name: "NSLDS Postscreening Reason Code", path: ["NSLDS_Postscreening_Reason_Code"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "10": "Exceeded combined loan limit",
        "11": "Exceeding subsidized loan limit resolved",
        "12": "Exceeding combined loan limit resolved",
        "13": "For Federal Student Aid use only",
        "14": "Loan entered active bankruptcy",
        "15": "PLUS Master Promissory Note status change",
        "16": "Grad PLUS Master Promissory Note status change",
        "17": "Fraud conviction added",
        "18": "Fraud conviction resolved",
        "19": "TEACH Grant converted to a loan",
        "20": "Pell eligible and met or exceeded Pell lifetime limit",
        "21": "No longer meeting or exceeding Pell lifetime limit",
        "22": "Pell eligible and close to Pell lifetime limit",
        "23": "No longer close to Pell lifetime limit",
        "24": "Unusual enrollment history status change",
        "25": "Subsidized Usage Limit Applies Flag status change",
        "26": "Confirmed loan subsidy status change",
        "27": "Decrease in Subsidized usage period",
        "99": "Other",
        "01": "Default added",
        "02": "Overpayment added",
        "03": "Default resolved",
        "04": "Overpayment resolved",
        "05": "Master Promissory Note status change",
        "06": "Loan went into disability discharged status",
        "07": "Loan out of disability discharged status",
        "08": "Closed school",
        "09": "Exceeded subsidized loan limit",
        "": "Not an NSLDS postscreening transaction",
      }},
    ],
    note: [
        "01 = Default added",
        "02 = Overpayment added",
        "03 = Default resolved",
        "04 = Overpayment resolved",
        "05 = Master Promissory Note status change",
        "06 = Loan went into disability discharged status",
        "07 = Loan out of disability discharged status",
        "08 = Closed school",
        "09 = Exceeded subsidized loan limit",
        "10 = Exceeded combined loan limit",
        "11 = Exceeding subsidized loan limit resolved",
        "12 = Exceeding combined loan limit resolved",
        "13 = For Federal Student Aid use only",
        "14 = Loan entered active bankruptcy",
        "15 = PLUS Master Promissory Note status change",
        "16 = Grad PLUS Master Promissory Note status change",
        "17 = Fraud conviction added",
        "18 = Fraud conviction resolved",
        "19 = TEACH Grant converted to a loan",
        "20 = Pell eligible and met or exceeded Pell lifetime limit",
        "21 = No longer meeting or exceeding Pell lifetime limit",
        "22 = Pell eligible and close to Pell lifetime limit",
        "23 = No longer close to Pell lifetime limit",
        "24 = Unusual enrollment history status change",
        "25 = Subsidized Usage Limit Applies Flag status change",
        "26 = Confirmed loan subsidy status change",
        "27 = Decrease in Subsidized usage period",
        "99 = Other",
        "Blank = Not an NSLDS postscreening transaction"
    ]};

export const field_562 = {len: 1, pos_start: 3882, pos_end: 3883,
    idx: 562, name: "Student SSA Citizenship Flag Results", path: ["student","SSA_Citizenship_Flag_Results"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "A": "U.S. citizen",
        "B": "Legal alien, eligible to work",
        "C": "Legal alien, not eligible to work",
        "D": "Other",
        "E": "Alien, student restricted, work authorized",
        "F": "Conditionally legalized alien",
        "N": "Unable to confirm citizenship due to no match on SSN, name or date of birth",
        "*": "Foreign",
        "": "Domestic born (U.S. citizen) if Student equals 4 or No match conducted if SSA Match Status does not equal 4",
      }},
    ],
    note: [
        "A = U.S. citizen",
        "B = Legal alien, eligible to work",
        "C = Legal alien, not eligible to work",
        "D = Other",
        "E = Alien, student restricted, work authorized",
        "F = Conditionally legalized alien",
        "N = Unable to confirm citizenship due to no match on SSN, name or date of birth",
        "* = Foreign",
        "Blank = Domestic born (U.S. citizen) if Student equals 4 or No match conducted if SSA Match Status does not equal 4"
    ]};

export const field_563 = {len: 1, pos_start: 3883, pos_end: 3884,
    idx: 563, name: "Student SSA Match Status", path: ["student","SSA_Match_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Not found by SSA",
        "2": "DOB mismatch",
        "3": "Name mismatch",
        "4": "Full match",
        "5": "Deceased",
        "6": "SSN not verified",
        "8": "Not sent",
        "9": "Not needed",
      }},
    ],
    note: [
        "1 = Not found by SSA",
        "2 = DOB mismatch",
        "3 = Name mismatch",
        "4 = Full match",
        "5 = Deceased",
        "6 = SSN not verified",
        "8 = Not sent",
        "9 = Not needed"
    ]};

export const field_564 = {len: 1, pos_start: 3884, pos_end: 3885,
    idx: 564, name: "Student Spouse SSA Match Status", path: ["student_spouse","SSA_Match_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Not found by SSA",
        "2": "DOB mismatch",
        "3": "Name mismatch",
        "4": "Full match",
        "5": "Deceased",
        "6": "SSN not verified",
        "8": "Not sent",
        "9": "Not needed",
      }},
    ],
    note: [
        "1 = Not found by SSA",
        "2 = DOB mismatch",
        "3 = Name mismatch",
        "4 = Full match",
        "5 = Deceased",
        "6 = SSN not verified",
        "8 = Not sent",
        "9 = Not needed"
    ]};

export const field_565 = {len: 1, pos_start: 3885, pos_end: 3886,
    idx: 565, name: "Parent SSA Match Status", path: ["parent","SSA_Match_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Not found by SSA",
        "2": "DOB mismatch",
        "3": "Name mismatch",
        "4": "Full match",
        "5": "Deceased",
        "6": "SSN not verified",
        "8": "Not sent",
        "9": "Not needed",
      }},
    ],
    note: [
        "1 = Not found by SSA",
        "2 = DOB mismatch",
        "3 = Name mismatch",
        "4 = Full match",
        "5 = Deceased",
        "6 = SSN not verified",
        "8 = Not sent",
        "9 = Not needed"
    ]};

export const field_566 = {len: 1, pos_start: 3886, pos_end: 3887,
    idx: 566, name: "Parent Spouse or Partner SSA Match Status", path: ["parent_spouse","SSA_Match_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Not found by SSA",
        "2": "DOB mismatch",
        "3": "Name mismatch",
        "4": "Full match",
        "5": "Deceased",
        "6": "SSN not verified",
        "8": "Not sent",
        "9": "Not needed",
      }},
    ],
    note: [
        "1 = Not found by SSA",
        "2 = DOB mismatch",
        "3 = Name mismatch",
        "4 = Full match",
        "5 = Deceased",
        "6 = SSN not verified",
        "8 = Not sent",
        "9 = Not needed"
    ]};

export const field_567 = {len: 1, pos_start: 3887, pos_end: 3888,
    idx: 567, name: "VA Match Flag", path: ["VA_Match_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Confirmed",
        "2": "Not Qualifying Veteran",
        "3": "Not found by VA",
        "4": "Active Duty",
        "8": "Not sent",
        "": "Not needed",
      }},
    ],
    note: [
        "1 = Confirmed",
        "2 = Not Qualifying Veteran",
        "3 = Not found by VA",
        "4 = Active Duty",
        "8 = Not sent",
        "Blank = Not needed"
    ]};

export const field_568 = {len: 60, pos_start: 3888, pos_end: 3948,
    idx: 568, name: "Comment Codes", path: ["Comment_Codes"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Twenty 3-digit numeric comment codes"
    ]};

export const field_569 = {len: 1, pos_start: 3948, pos_end: 3949,
    idx: 569, name: "Drug Abuse Hold Indicator", path: ["Drug_Abuse_Hold_Indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "J": "Record placed on hold by Dept. of Justice",
        "S": "Record released from hold",
        "": "Not on hold",
      }},
    ],
    note: [
        "J = Record placed on hold by Dept. of Justice",
        "S = Record released from hold",
        "Blank = Not on hold"
    ]};

export const field_570 = {len: 1, pos_start: 3949, pos_end: 3950,
    idx: 570, name: "Graduate Flag", path: ["Graduate_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes response to First Bachelor’s Degree By 07-01-2024 question and/or graduate status question",
        "": "Graduate flag not set",
      }},
    ],
    note: [
        "Y = Yes response to First Bachelor’s Degree By 07-01-2024 question and/or graduate status question",
        "Blank = Graduate flag not set"
    ]};

export const field_571 = {len: 1, pos_start: 3950, pos_end: 3951,
    idx: 571, name: "Pell Grant Eligibility Flag", path: ["Pell_Grant_Eligibility_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "This transaction determined eligible for a Federal Pell Grant",
        "": "This transaction determined ineligible for a Federal Pell Grant",
      }},
    ],
    note: [
        "Y = This transaction determined eligible for a Federal Pell Grant",
        "Blank = This transaction determined ineligible for a Federal Pell Grant"
    ]};

export const field_572 = {len: 2, pos_start: 3951, pos_end: 3953,
    idx: 572, name: "Reprocessed Reason Code", path: ["Reprocessed_Reason_Code"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"01","max":"99"},
      {op: "enum", options: {
        "50": "System-generated from the match bypass process",
        "01": "Reprocessed due to change in the Pell Maximum SAI",
        "": "Not a reprocessed transaction",
      }},
    ],
    note: [
        "01 to 99",
        "01 = Reprocessed due to change in the Pell Maximum SAI",
        "50 = System-generated from the match bypass process",
        "Blank = Not a reprocessed transaction"
    ]};

export const field_573 = {len: 1, pos_start: 3953, pos_end: 3954,
    idx: 573, name: "FPS C Flag", path: ["FPS_C_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "FPS C flag set, resolution required on one or more match results",
        "": "No flag set",
      }},
    ],
    note: [
        "Y = FPS C flag set, resolution required on one or more match results",
        "Blank = No flag set"
    ]};

export const field_574 = {len: 1, pos_start: 3954, pos_end: 3955,
    idx: 574, name: "FPS C Change Flag", path: ["FPS_C_Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "FPS C flag has changed",
        "": "No change to FPS C flag",
      }},
    ],
    note: [
        "Y = FPS C flag has changed",
        "Blank = No change to FPS C flag"
    ]};

export const field_575 = {len: 2, pos_start: 3955, pos_end: 3957,
    idx: 575, name: "Electronic Federal School Code Indicator", path: ["Electronic_Federal_School_Code_Indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Federal school code #1",
        "2": "Federal school code #2",
        "3": "Federal school code #3",
        "4": "Federal school code #4",
        "5": "Federal school code #5",
        "6": "Federal school code #6",
        "7": "Federal school code #7",
        "8": "Federal school code #8",
        "9": "Federal school code #9",
        "10": "Federal school code #10",
        "11": "Federal school code #11",
        "12": "Federal school code #12",
        "13": "Federal school code #13",
        "14": "Federal school code #14",
        "15": "Federal school code #15",
        "16": "Federal school code #16",
        "17": "Federal school code #17",
        "18": "Federal school code #18",
        "19": "Federal school code #19",
        "20": "Federal school code #20",
        "": "Always blank on school and servicer ISIRs; for state agencies, no federal school code",
      }},
    ],
    note: [
        "1 = Federal school code #1",
        "2 = Federal school code #2",
        "3 = Federal school code #3",
        "4 = Federal school code #4",
        "5 = Federal school code #5",
        "6 = Federal school code #6",
        "7 = Federal school code #7",
        "8 = Federal school code #8",
        "9 - Federal school code #9",
        "10 - Federal school code #10",
        "11 = Federal school code #11",
        "12 = Federal school code #12",
        "13 = Federal school code #13",
        "14 = Federal school code #14",
        "15 = Federal school code #15",
        "16 = Federal school code #16",
        "17 = Federal school code #17",
        "18 = Federal school code #18",
        "19 - Federal school code #19",
        "20 - Federal school code #20",
        "Blank = Always blank on school and servicer ISIRs; for state agencies, no federal school code"
    ]};

export const field_576 = {len: 110, pos_start: 3957, pos_end: 4067,
    idx: 576, name: "Reject Reason Codes", path: ["Reject_Reason_Codes"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Uppercase letters",
        "A to Z Numbers",
        "1 to 99",
        "Blank = Applicant not rejected"
    ]};

export const field_577 = {len: 1, pos_start: 4067, pos_end: 4068,
    idx: 577, name: "Electronic Transaction Indicator Flag", alias: "ETI", path: ["Electronic_Transaction_Indicator_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "School did not generate transaction, receives ISIR daily",
        "2": "School generated, receives ISIR daily",
        "3": "School did not generate transaction, ISIR pushed",
        "4": "School generated transaction, ISIR pushed",
        "5": "School did not generate transaction, FPS system generated",
        "6": "School generated, ISIR request school",
        "7": "School did not generate, ISIR Request school",
        "": "School is not found or not participating",
      }},
    ],
    note: [
        "1 = School did not generate transaction, receives ISIR daily",
        "2 = School generated, receives ISIR daily",
        "3 = School did not generate transaction, ISIR pushed",
        "4 = School generated transaction, ISIR pushed",
        "5 = School did not generate transaction, FPS system generated",
        "6 = School generated, ISIR request school",
        "7 = School did not generate, ISIR Request school",
        "Blank = School is not found or not participating"
    ]};

export const field_578 = {len: 1, pos_start: 4068, pos_end: 4069,
    idx: 578, name: "Student Last Name/ SSN Change Flag", path: ["student","Last_Name_SSN_Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "N": "Last name change",
        "S": "Social Security number change",
        "B": "Social Security number and last name change",
        "": "No change",
      }},
    ],
    note: [
        "N = Last name change",
        "S = Social Security number change",
        "B = Social Security number and last name change",
        "Blank = No change"
    ]};

export const field_579 = {len: 12, pos_start: 4069, pos_end: 4081,
    idx: 579, name: "High School Code", path: ["High_School_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alphanumeric",
        "0-9",
        "Uppercase and lowercase A-Z",
        "Blank"
    ]};

export const field_580 = {len: 1, pos_start: 4081, pos_end: 4082,
    idx: 580, name: "Verification Selection Change Flag", path: ["Verification_Selection_Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Selected for verification on this transaction, not selected for verification on any previous non-rejected transaction",
        "C": "Selected for verification on this transaction, Verification Tracking Flag is not equal to Verification Tracking Flag on transaction being corrected",
      }},
    ],
    note: [
        "Y = Selected for verification on this transaction, not selected for verification on any previous non-rejected transaction",
        "C = Selected for verification on this transaction, Verification Tracking Flag is not equal to Verification Tracking Flag on transaction being corrected",
        "Blank"
    ]};

export const field_581 = {len: 5, pos_start: 4082, pos_end: 4087,
    idx: 581, name: "Use User Provided Data Only", path: ["Use_User_Provided_Data_Only"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "True": "True",
        "False": "False",
      }},
    ],
    note: [
        "True",
        "False"
    ]};

export const field_582 = {len: 361, pos_start: 4087, pos_end: 4448,
    idx: 582, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};


export const section_matches = /* #__PURE__ */ {
    section: "Matches and Other Processing Information",
    path: ["matches"],
    field_list: [field_557, field_558, field_559, field_560, field_561, field_562, field_563, field_564, field_565, field_566, field_567, field_568, field_569, field_570, field_571, field_572, field_573, field_574, field_575, field_576, field_577, field_578, field_579, field_580, field_581, field_582],
}


//*********************************************
// Section: NSLDS Information
//

export const field_583 = {len: 1, pos_start: 4448, pos_end: 4449,
    idx: 583, name: "NSLDS Pell Overpayment Flag", path: ["pell_grant","Overpayment_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "D": "Deferred",
        "N": "N/A",
        "S": "Satisfactory payment arrangements",
        "F": "Fraud",
        "W": "Waived",
        "Y": "Overpayment",
      }},
    ],
    note: [
        "D = Deferred",
        "N = N/A",
        "S = Satisfactory payment arrangements",
        "F = Fraud",
        "W = Waived",
        "Y = Overpayment",
        "Blank"
    ]};

export const field_584 = {len: 8, pos_start: 4449, pos_end: 4457,
    idx: 584, name: "NSLDS Pell Overpayment Contact", path: ["pell_grant","Overpayment_Contact"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
        "Y": "Y",
      }},
    ],
    note: [
        "Numeric school code or region code",
        "N/A",
        "Y (more than one)",
        "Blank"
    ]};

export const field_585 = {len: 1, pos_start: 4457, pos_end: 4458,
    idx: 585, name: "NSLDS FSEOG Overpayment Flag", path: ["FSEOG_Overpayment_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "D": "Deferred",
        "N": "N/A",
        "S": "Satisfactory payment arrangements",
        "F": "Fraud",
        "W": "Waived",
        "Y": "Overpayment",
      }},
    ],
    note: [
        "D = Deferred",
        "N = N/A",
        "S = Satisfactory payment arrangements",
        "F = Fraud",
        "W = Waived",
        "Y = Overpayment",
        "Blank"
    ]};

export const field_586 = {len: 8, pos_start: 4458, pos_end: 4466,
    idx: 586, name: "NSLDS FSEOG Overpayment Contact", path: ["FSEOG_Overpayment_Contact"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
        "Y": "Y",
      }},
    ],
    note: [
        "Numeric school code or region code",
        "N/A",
        "Y (more than one)",
        "Blank"
    ]};

export const field_587 = {len: 1, pos_start: 4466, pos_end: 4467,
    idx: 587, name: "NSLDS Perkins Overpayment Flag", path: ["perkins","Overpayment_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "D": "Deferred",
        "N": "N/A",
        "S": "Satisfactory payment arrangements",
        "F": "Fraud",
        "W": "Waived",
        "Y": "Overpayment",
      }},
    ],
    note: [
        "D = Deferred",
        "N = N/A",
        "S = Satisfactory payment arrangements",
        "F = Fraud",
        "W = Waived",
        "Y = Overpayment",
        "Blank"
    ]};

export const field_588 = {len: 8, pos_start: 4467, pos_end: 4475,
    idx: 588, name: "NSLDS Perkins Overpayment Contact", path: ["perkins","Overpayment_Contact"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
        "Y": "Y",
      }},
    ],
    note: [
        "Numeric school code or region code",
        "N/A",
        "Y (more than one)",
        "Blank"
    ]};

export const field_589 = {len: 1, pos_start: 4475, pos_end: 4476,
    idx: 589, name: "NSLDS TEACH Grant Overpayment Flag", path: ["teach","grant","Overpayment_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "D": "Deferred",
        "N": "N/A",
        "S": "Satisfactory payment arrangements",
        "F": "Fraud",
        "W": "Waived",
        "Y": "Overpayment",
      }},
    ],
    note: [
        "D = Deferred",
        "N = N/A",
        "S = Satisfactory payment arrangements",
        "F = Fraud",
        "W = Waived",
        "Y = Overpayment",
        "Blank"
    ]};

export const field_590 = {len: 8, pos_start: 4476, pos_end: 4484,
    idx: 590, name: "NSLDS TEACH Grant Overpayment Contact", path: ["teach","grant","Overpayment_Contact"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
        "Y": "Y",
      }},
    ],
    note: [
        "Numeric school code or region code",
        "N/A",
        "Y (more than one)",
        "Blank"
    ]};

export const field_591 = {len: 1, pos_start: 4484, pos_end: 4485,
    idx: 591, name: "NSLDS Iraq and Afghanistan Service Grant Overpayment Flag", path: ["Iraq_and_Afghanistan_Service_Grant_Overpayment_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "D": "Deferred",
        "N": "N/A",
        "S": "Satisfactory payment arrangements",
        "F": "Fraud",
        "W": "Waived",
        "Y": "Overpayment",
      }},
    ],
    note: [
        "D = Deferred",
        "N = N/A",
        "S = Satisfactory payment arrangements",
        "F = Fraud",
        "W = Waived",
        "Y = Overpayment",
        "Blank"
    ]};

export const field_592 = {len: 8, pos_start: 4485, pos_end: 4493,
    idx: 592, name: "NSLDS Iraq and Afghanistan Service Grant Overpayment Contact", path: ["Iraq_and_Afghanistan_Service_Grant_Overpayment_Contact"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
        "Y": "Y",
      }},
    ],
    note: [
        "Numeric school code or region code",
        "N/A",
        "Y (more than one)",
        "Blank"
    ]};

export const field_593 = {len: 1, pos_start: 4493, pos_end: 4494,
    idx: 593, name: "NSLDS Defaulted Loan Flag", path: ["Defaulted_Loan_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_594 = {len: 1, pos_start: 4494, pos_end: 4495,
    idx: 594, name: "NSLDS Discharged Loan Flag", path: ["Discharged_Loan_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "C": "Conditional",
        "D": "Death",
        "M": "Multiple",
        "N": "None",
        "P": "Permanent",
      }},
    ],
    note: [
        "C = Conditional",
        "D = Death",
        "M = Multiple",
        "N = None",
        "P = Permanent",
        "Blank"
    ]};

export const field_595 = {len: 1, pos_start: 4495, pos_end: 4496,
    idx: 595, name: "NSLDS Fraud Loan Flag", path: ["Fraud_Loan_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
        "": "Record not sent for match",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank = Record not sent for match"
    ]};

export const field_596 = {len: 1, pos_start: 4496, pos_end: 4497,
    idx: 596, name: "NSLDS Satisfactory Arrangements Flag", path: ["Satisfactory_Arrangements_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_597 = {len: 1, pos_start: 4497, pos_end: 4498,
    idx: 597, name: "NSLDS Active Bankruptcy Flag", path: ["Active_Bankruptcy_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_598 = {len: 1, pos_start: 4498, pos_end: 4499,
    idx: 598, name: "NSLDS TEACH Grant Loan Convertedd to Loan Flag", path: ["teach","grant","Loan_Convertedd_to_Loan_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_599 = {len: 6, pos_start: 4499, pos_end: 4505,
    idx: 599, name: "NSLDS Aggregate Subsidized Outstanding Principal Balance", path: ["aggregate","Subsidized_Outstanding_Principal_Balance"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_600 = {len: 6, pos_start: 4505, pos_end: 4511,
    idx: 600, name: "NSLDS Aggregate Unsubsidized Outstanding Principal Balance", path: ["aggregate","Unsubsidized_Outstanding_Principal_Balance"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_601 = {len: 6, pos_start: 4511, pos_end: 4517,
    idx: 601, name: "NSLDS Aggregate Combined Outstanding Principal Balance", path: ["aggregate","Combined_Outstanding_Principal_Balance"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_602 = {len: 6, pos_start: 4517, pos_end: 4523,
    idx: 602, name: "NSLDS Aggregate Unallocated Consolidated Outstanding Principal Balance", path: ["aggregate","Unallocated_Consolidated_Outstanding_Principal_Balance"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_603 = {len: 6, pos_start: 4523, pos_end: 4529,
    idx: 603, name: "NSLDS Aggregate TEACH Loan Principal Balance", path: ["aggregate","TEACH_Loan_Principal_Balance"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_604 = {len: 6, pos_start: 4529, pos_end: 4535,
    idx: 604, name: "NSLDS Aggregate Subsidized Pending Disbursement", path: ["aggregate","Subsidized_Pending_Disbursement"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_605 = {len: 6, pos_start: 4535, pos_end: 4541,
    idx: 605, name: "NSLDS Aggregate Unsubsidized Pending Disbursement", path: ["aggregate","Unsubsidized_Pending_Disbursement"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_606 = {len: 6, pos_start: 4541, pos_end: 4547,
    idx: 606, name: "NSLDS Aggregate Combined Pending Disbursement", path: ["aggregate","Combined_Pending_Disbursement"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_607 = {len: 6, pos_start: 4547, pos_end: 4553,
    idx: 607, name: "NSLDS Aggregate Subsidized Total", path: ["aggregate","Subsidized_Total"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_608 = {len: 6, pos_start: 4553, pos_end: 4559,
    idx: 608, name: "NSLDS Aggregate Unsubsidized Total", path: ["aggregate","Unsubsidized_Total"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_609 = {len: 6, pos_start: 4559, pos_end: 4565,
    idx: 609, name: "NSLDS Aggregate Combined Total", path: ["aggregate","Combined_Total"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_610 = {len: 6, pos_start: 4565, pos_end: 4571,
    idx: 610, name: "NSLDS Unallocated Consolidated Total", path: ["Unallocated_Consolidated_Total"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_611 = {len: 6, pos_start: 4571, pos_end: 4577,
    idx: 611, name: "NSLDS TEACH Loan Total", path: ["teach","Loan_Total"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_612 = {len: 6, pos_start: 4577, pos_end: 4583,
    idx: 612, name: "NSLDS Perkins Total Disbursements", path: ["perkins","Total_Disbursements"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_613 = {len: 6, pos_start: 4583, pos_end: 4589,
    idx: 613, name: "NSLDS Perkins Current Year Disbursement Amount", path: ["perkins","Current_Year_Disbursement_Amount"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_614 = {len: 6, pos_start: 4589, pos_end: 4595,
    idx: 614, name: "NSLDS Aggregate TEACH Grant Undergraduate Disbursed Total", path: ["aggregate","TEACH_Grant_Undergraduate_Disbursed_Total"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_615 = {len: 6, pos_start: 4595, pos_end: 4601,
    idx: 615, name: "NSLDS Aggregate TEACH Graduate Disbursement Amount", path: ["aggregate","TEACH_Graduate_Disbursement_Amount"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_616 = {len: 1, pos_start: 4601, pos_end: 4602,
    idx: 616, name: "NSLDS Defaulted Loan Change Flag", path: ["Defaulted_Loan_Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "#": "Changed",
        "N": "Did not change",
      }},
    ],
    note: [
        "# = Changed",
        "N = Did not change",
        "Blank"
    ]};

export const field_617 = {len: 1, pos_start: 4602, pos_end: 4603,
    idx: 617, name: "NSLDS Fraud Loan Change Flag", path: ["Fraud_Loan_Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "#": "Changed",
        "N": "Did not change",
      }},
    ],
    note: [
        "# = Changed",
        "N = Did not change",
        "Blank"
    ]};

export const field_618 = {len: 1, pos_start: 4603, pos_end: 4604,
    idx: 618, name: "NSLDS Discharged Loan Change Flag", path: ["Discharged_Loan_Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "#": "Changed",
        "N": "Did not change",
      }},
    ],
    note: [
        "# = Changed",
        "N = Did not change",
        "Blank"
    ]};

export const field_619 = {len: 1, pos_start: 4604, pos_end: 4605,
    idx: 619, name: "NSLDS Loan Satisfactory Repayment Change Flag", path: ["loan","Satisfactory_Repayment_Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "#": "Changed",
        "N": "Did not change",
      }},
    ],
    note: [
        "# = Changed",
        "N = Did not change",
        "Blank"
    ]};

export const field_620 = {len: 1, pos_start: 4605, pos_end: 4606,
    idx: 620, name: "NSLDS Active Bankruptcy Change Flag", path: ["Active_Bankruptcy_Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "#": "Changed",
        "N": "Did not change",
      }},
    ],
    note: [
        "# = Changed",
        "N = Did not change",
        "Blank"
    ]};

export const field_621 = {len: 1, pos_start: 4606, pos_end: 4607,
    idx: 621, name: "NSLDS TEACH Grant to Loan Conversion Change Flag", path: ["teach","grant","to_Loan_Conversion_Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "#": "Changed",
        "N": "Did not change",
      }},
    ],
    note: [
        "# = Changed",
        "N = Did not change",
        "Blank"
    ]};

export const field_622 = {len: 1, pos_start: 4607, pos_end: 4608,
    idx: 622, name: "NSLDS Overpayments Change Flag", path: ["Overpayments_Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "#": "Changed",
        "N": "Did not change",
      }},
    ],
    note: [
        "# = Changed",
        "N = Did not change",
        "Blank"
    ]};

export const field_623 = {len: 1, pos_start: 4608, pos_end: 4609,
    idx: 623, name: "NSLDS Aggregate Loan Change Flag", path: ["aggregate","Loan_Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "#": "Changed",
        "N": "Did not change",
      }},
    ],
    note: [
        "# = Changed",
        "N = Did not change",
        "Blank"
    ]};

export const field_624 = {len: 1, pos_start: 4609, pos_end: 4610,
    idx: 624, name: "NSLDS Perkins Loan Change Flag", path: ["perkins","Loan_Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "#": "Changed",
        "N": "Did not change",
      }},
    ],
    note: [
        "# = Changed",
        "N = Did not change",
        "Blank"
    ]};

export const field_625 = {len: 1, pos_start: 4610, pos_end: 4611,
    idx: 625, name: "NSLDS Pell Payment Change Flag", path: ["pell_grant","Payment_Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "#": "Changed",
        "N": "Did not change",
      }},
    ],
    note: [
        "# = Changed",
        "N = Did not change",
        "Blank"
    ]};

export const field_626 = {len: 1, pos_start: 4611, pos_end: 4612,
    idx: 626, name: "NSLDS TEACH Grant Change Flag", path: ["teach","grant","Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "#": "Changed",
        "N": "Did not change",
      }},
    ],
    note: [
        "# = Changed",
        "N = Did not change",
        "Blank"
    ]};

export const field_627 = {len: 1, pos_start: 4612, pos_end: 4613,
    idx: 627, name: "NSLDS Additional Pell Flag", path: ["Additional_Pell_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_628 = {len: 1, pos_start: 4613, pos_end: 4614,
    idx: 628, name: "NSLDS Additional Loans Flag", path: ["Additional_Loans_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_629 = {len: 1, pos_start: 4614, pos_end: 4615,
    idx: 629, name: "NSLDS Additional TEACH Grant Flag", path: ["Additional_TEACH_Grant_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_630 = {len: 1, pos_start: 4615, pos_end: 4616,
    idx: 630, name: "NSLDS Direct Loan Master Prom Note Flag", path: ["Direct_Loan_Master_Prom_Note_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "A": "Active",
        "C": "Closed",
        "I": "Inactive",
        "N": "No Master Promissory Note on file",
        "": "No data from NSLDS",
      }},
    ],
    note: [
        "A = Active",
        "C = Closed",
        "I = Inactive",
        "N = No Master Promissory Note on file",
        "Blank = No data from NSLDS"
    ]};

export const field_631 = {len: 1, pos_start: 4616, pos_end: 4617,
    idx: 631, name: "NSLDS Direct Loan PLUS Master Prom Note Flag", path: ["Direct_Loan_PLUS_Master_Prom_Note_Flag"], 
    extra: ["This flag indicates the status of the Master Promissory Note for the parent who has borrowed a PLUS loan on behalf of this student."],
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "A": "Active",
        "C": "Closed",
        "E": "Inactive due to the linking of a PLUS Loan with an endorser",
        "I": "Inactive",
        "N": "No Master Promissory Note on file",
        "": "No data from NSLDS",
      }},
    ],
    note: [
        "A = Active",
        "C = Closed",
        "E = Inactive due to the linking of a PLUS Loan with an endorser",
        "I = Inactive",
        "N = No Master Promissory Note on file",
        "Blank = No data from NSLDS"
    ]};

export const field_632 = {len: 1, pos_start: 4617, pos_end: 4618,
    idx: 632, name: "NSLDS Direct Loan Graduate PLUS Master Prom Note Flag", path: ["Direct_Loan_Graduate_PLUS_Master_Prom_Note_Flag"], 
    extra: ["This flag indicates the status of the Master Promissory Note for the graduate student who has borrowed a PLUS loan."],
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "A": "Active",
        "C": "Closed",
        "E": "Inactive due to the linking of a PLUS Loan with an endorser",
        "I": "Inactive",
        "N": "No Master Promissory Note on file",
        "": "No data from NSLDS",
      }},
    ],
    note: [
        "A = Active",
        "C = Closed",
        "E = Inactive due to the linking of a PLUS Loan with an endorser",
        "I = Inactive",
        "N = No Master Promissory Note on file",
        "Blank = No data from NSLDS"
    ]};

export const field_633 = {len: 1, pos_start: 4618, pos_end: 4619,
    idx: 633, name: "NSLDS Undergraduate Subsidized Loan Limit Flag", path: ["Undergraduate_Subsidized_Loan_Limit_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "C": "Close to or equal to limit",
        "E": "Exceeded limit",
        "N": "No problem",
      }},
    ],
    note: [
        "C = Close to or equal to limit",
        "E = Exceeded limit",
        "N = No problem",
        "Blank"
    ]};

export const field_634 = {len: 1, pos_start: 4619, pos_end: 4620,
    idx: 634, name: "NSLDS Undergraduate Combined Loan Limit Flag", path: ["Undergraduate_Combined_Loan_Limit_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "C": "Close to or equal to limit",
        "E": "Exceeded limit",
        "N": "No problem",
      }},
    ],
    note: [
        "C = Close to or equal to limit",
        "E = Exceeded limit",
        "N = No problem",
        "Blank"
    ]};

export const field_635 = {len: 1, pos_start: 4620, pos_end: 4621,
    idx: 635, name: "NSLDS Graduate Subsidized Loan Limit Flag", path: ["Graduate_Subsidized_Loan_Limit_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "C": "Close to or equal to limit",
        "E": "Exceeded limit",
        "N": "No problem",
      }},
    ],
    note: [
        "C = Close to or equal to limit",
        "E = Exceeded limit",
        "N = No problem",
        "Blank"
    ]};

export const field_636 = {len: 1, pos_start: 4621, pos_end: 4622,
    idx: 636, name: "NSLDS Graduate Combined Loan Limit Flag", path: ["Graduate_Combined_Loan_Limit_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "C": "Close to or equal to limit",
        "E": "Exceeded limit",
        "N": "No problem",
      }},
    ],
    note: [
        "C = Close to or equal to limit",
        "E = Exceeded limit",
        "N = No problem",
        "Blank"
    ]};

export const field_637 = {len: 1, pos_start: 4622, pos_end: 4623,
    idx: 637, name: "NSLDS Pell Lifetime Limit Flag", path: ["pell_grant","Lifetime_Limit_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "C": "Close to Pell limit",
        "E": "Met or Exceeded Pell limit",
        "H": "High Pell percent",
        "N": "No problem",
      }},
    ],
    note: [
        "C = Close to Pell limit",
        "E = Met or Exceeded Pell limit",
        "H = High Pell percent",
        "N = No problem",
        "Blank"
    ]};

export const field_638 = {len: 7, pos_start: 4623, pos_end: 4630,
    idx: 638, name: "NSLDS Pell Lifetime Eligibility Used", path: ["pell_grant","Lifetime_Eligibility_Used"], 
    validate: _validate_fixed_decimal,
    "divisor":100000,
    note: [
        "Numeric",
        "Format is 99v99999",
        "Blank",
        "“v” is an implied decimal and is not included in the output.",
        "Example: 01.00000 is 0100.000%"
    ]};

export const field_639 = {len: 1, pos_start: 4630, pos_end: 4631,
    idx: 639, name: "NSLDS SULA Flag", path: ["SULA_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_640 = {len: 6, pos_start: 4631, pos_end: 4637,
    idx: 640, name: "NSLDS Subsidized Limit Eligiblity Used", path: ["Subsidized_Limit_Eligiblity_Used"], 
    validate: _validate_fixed_decimal,
    "divisor":1000,
    note: [
        "Numeric",
        "Format is 999v999",
        "Blank",
        "“v” is an implied decimal and is not included in the output"
    ]};

export const field_641 = {len: 1, pos_start: 4637, pos_end: 4638,
    idx: 641, name: "NSLDS Unusual Enrollment History Flag", path: ["Unusual_Enrollment_History_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "2": "Possible enrollment pattern problem, school may need to resolve",
        "3": "Questionable enrollment pattern, school must resolve",
        "N": "Enrollment pattern not unusual, no school action required",
        "": "Record not sent for match",
      }},
    ],
    note: [
        "2 = Possible enrollment pattern problem, school may need to resolve",
        "3 = Questionable enrollment pattern, school must resolve",
        "N = Enrollment pattern not unusual, no school action required",
        "Blank = Record not sent for match"
    ]};

export const field_642 = {len: 20, pos_start: 4638, pos_end: 4658,
    idx: 642, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};

export const field_643 = {len: 2, pos_start: 4658, pos_end: 4660,
    idx: 643, name: "NSLDS Pell Sequence Number (1)", path: ["pell_grant","by_index",1,"Sequence_Number"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"01","max":"03"},
    ],
    note: [
        "01 to 03",
        "Blank"
    ]};

export const field_644 = {len: 3, pos_start: 4660, pos_end: 4663,
    idx: 644, name: "NSLDS Pell Verification Flag (1)", path: ["pell_grant","by_index",1,"Verification_Flag"], 
    validate: _validate_options,
    options: [
      {op: "alpha", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alpha",
        "N/A",
        "Blank"
    ]};

export const field_645 = {len: 6, pos_start: 4663, pos_end: 4669,
    idx: 645, name: "NSLDS SAI (1)", path: ["SAI",1], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-1500","max":"999999"},
    ],
    note: [
        "-1500 to 999999",
        "Blank"
    ]};

export const field_646 = {len: 8, pos_start: 4669, pos_end: 4677,
    idx: 646, name: "NSLDS Pell School Code (1)", path: ["pell_grant","by_index",1,"School_Code"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_647 = {len: 2, pos_start: 4677, pos_end: 4679,
    idx: 647, name: "NSLDS Pell Transaction Number (1)", path: ["pell_grant","by_index",1,"Transaction_Number"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_648 = {len: 8, pos_start: 4679, pos_end: 4687,
    idx: 648, name: "NSLDS Pell Disbursement Date (1)", path: ["pell_grant","by_index",1,"Disbursement_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_649 = {len: 6, pos_start: 4687, pos_end: 4693,
    idx: 649, name: "NSLDS Pell Scheduled Amount (1)", path: ["pell_grant","by_index",1,"Scheduled_Amount"], 
    extra: ["Whole dollar amount with leading zeros."],
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_650 = {len: 6, pos_start: 4693, pos_end: 4699,
    idx: 650, name: "NSLDS Pell Amount Paid to Date (1)", path: ["pell_grant","by_index",1,"Amount_Paid_to_Date"], 
    extra: ["Whole dollar amount with leading zeros"],
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_651 = {len: 7, pos_start: 4699, pos_end: 4706,
    idx: 651, name: "NSLDS Pell Percent Eligibility Used Decimal (1)", path: ["pell_grant","by_index",1,"Percent_Eligibility_Used_Decimal"], 
    extra: ["Percent with four decimal places assumed for example, 50% - 0500000."],
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_652 = {len: 6, pos_start: 4706, pos_end: 4712,
    idx: 652, name: "NSLDS Pell Award Amount (1)", path: ["pell_grant","by_index",1,"Award_Amount"], 
    extra: ["Whole dollar amount with leading zeros."],
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_653 = {len: 1, pos_start: 4712, pos_end: 4713,
    idx: 653, name: "NSLDS Additional Eligibility Indicator (1)", path: ["additional_eligiblity_indicators",1], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_654 = {len: 20, pos_start: 4713, pos_end: 4733,
    idx: 654, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};

export const field_655 = {len: 2, pos_start: 4733, pos_end: 4735,
    idx: 655, name: "NSLDS Pell Sequence Number (2)", path: ["pell_grant","by_index",2,"Sequence_Number"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"01","max":"03"},
    ],
    note: [
        "01 to 03",
        "Blank"
    ]};

export const field_656 = {len: 3, pos_start: 4735, pos_end: 4738,
    idx: 656, name: "NSLDS Pell Verification Flag (2)", path: ["pell_grant","by_index",2,"Verification_Flag"], 
    validate: _validate_options,
    options: [
      {op: "alpha", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alpha",
        "N/A",
        "Blank"
    ]};

export const field_657 = {len: 6, pos_start: 4738, pos_end: 4744,
    idx: 657, name: "NSLDS SAI (2)", path: ["SAI",2], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-1500","max":"999999"},
    ],
    note: [
        "-1500 to 999999",
        "Blank"
    ]};

export const field_658 = {len: 8, pos_start: 4744, pos_end: 4752,
    idx: 658, name: "NSLDS Pell School Code (2)", path: ["pell_grant","by_index",2,"School_Code"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_659 = {len: 2, pos_start: 4752, pos_end: 4754,
    idx: 659, name: "NSLDS Pell Transaction Number (2)", path: ["pell_grant","by_index",2,"Transaction_Number"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_660 = {len: 8, pos_start: 4754, pos_end: 4762,
    idx: 660, name: "NSLDS Pell Last Disbursement Date (2)", path: ["pell_grant","by_index",2,"Last_Disbursement_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_661 = {len: 6, pos_start: 4762, pos_end: 4768,
    idx: 661, name: "NSLDS Pell Scheduled Amount (2)", path: ["pell_grant","by_index",2,"Scheduled_Amount"], 
    extra: ["Whole dollar amount with leading zeros."],
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_662 = {len: 6, pos_start: 4768, pos_end: 4774,
    idx: 662, name: "NSLDS Pell Amount Paid to Date (2)", path: ["pell_grant","by_index",2,"Amount_Paid_to_Date"], 
    extra: ["Whole dollar amount with leading zeros"],
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_663 = {len: 7, pos_start: 4774, pos_end: 4781,
    idx: 663, name: "NSLDS Pell Percent Eligibility Used Decimal (2)", path: ["pell_grant","by_index",2,"Percent_Eligibility_Used_Decimal"], 
    extra: ["Percent with four decimal places assumed for example, 50% - 0500000."],
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_664 = {len: 6, pos_start: 4781, pos_end: 4787,
    idx: 664, name: "NSLDS Pell Award Amount (2)", path: ["pell_grant","by_index",2,"Award_Amount"], 
    extra: ["Whole dollar amount with leading zeros."],
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_665 = {len: 1, pos_start: 4787, pos_end: 4788,
    idx: 665, name: "NSLDS Additional Eligibility Indicator (2)", path: ["additional_eligiblity_indicators",2], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Y",
        "N": "N",
      }},
    ],
    note: [
        "Y or N",
        "Blank"
    ]};

export const field_666 = {len: 20, pos_start: 4788, pos_end: 4808,
    idx: 666, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};

export const field_667 = {len: 2, pos_start: 4808, pos_end: 4810,
    idx: 667, name: "NSLDS Pell Sequence Number (3)", path: ["pell_grant","by_index",3,"Sequence_Number"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"01","max":"03"},
    ],
    note: [
        "01 to 03",
        "Blank"
    ]};

export const field_668 = {len: 3, pos_start: 4810, pos_end: 4813,
    idx: 668, name: "NSLDS Pell Verification Flag (3)", path: ["pell_grant","by_index",3,"Verification_Flag"], 
    validate: _validate_options,
    options: [
      {op: "alpha", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alpha",
        "N/A",
        "Blank"
    ]};

export const field_669 = {len: 6, pos_start: 4813, pos_end: 4819,
    idx: 669, name: "NSLDS SAI (3)", path: ["SAI",3], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-1500","max":"999999"},
    ],
    note: [
        "-1500 to 999999",
        "Blank"
    ]};

export const field_670 = {len: 8, pos_start: 4819, pos_end: 4827,
    idx: 670, name: "NSLDS Pell School Code (3)", path: ["pell_grant","by_index",3,"School_Code"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_671 = {len: 2, pos_start: 4827, pos_end: 4829,
    idx: 671, name: "NSLDS Pell Transaction Number (3)", path: ["pell_grant","by_index",3,"Transaction_Number"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_672 = {len: 8, pos_start: 4829, pos_end: 4837,
    idx: 672, name: "NSLDS Pell Last Disbursement Date (3)", path: ["pell_grant","by_index",3,"Last_Disbursement_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_673 = {len: 6, pos_start: 4837, pos_end: 4843,
    idx: 673, name: "NSLDS Pell Scheduled Amount (3)", path: ["pell_grant","by_index",3,"Scheduled_Amount"], 
    extra: ["Whole dollar amount with leading zeros."],
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_674 = {len: 6, pos_start: 4843, pos_end: 4849,
    idx: 674, name: "NSLDS Pell Amount Paid to Date (3)", path: ["pell_grant","by_index",3,"Amount_Paid_to_Date"], 
    extra: ["Whole dollar amount with leading zeros"],
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_675 = {len: 7, pos_start: 4849, pos_end: 4856,
    idx: 675, name: "NSLDS Pell Percent Eligibility Used Decimal (3)", path: ["pell_grant","by_index",3,"Percent_Eligibility_Used_Decimal"], 
    extra: ["Percent with four decimal places assumed for example, 50% - 0500000."],
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_676 = {len: 6, pos_start: 4856, pos_end: 4862,
    idx: 676, name: "NSLDS Pell Award Amount (3)", path: ["pell_grant","by_index",3,"Award_Amount"], 
    extra: ["Whole dollar amount with leading zeros."],
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_677 = {len: 1, pos_start: 4862, pos_end: 4863,
    idx: 677, name: "NSLDS Additional Eligibility Indicator (3)", path: ["additional_eligiblity_indicators",3], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_678 = {len: 20, pos_start: 4863, pos_end: 4883,
    idx: 678, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};

export const field_679 = {len: 2, pos_start: 4883, pos_end: 4885,
    idx: 679, name: "NSLDS TEACH Grant Sequence (1)", path: ["teach","grant","by_index",1,"Sequence"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"01","max":"03"},
    ],
    note: [
        "01 to 03",
        "Blank"
    ]};

export const field_680 = {len: 8, pos_start: 4885, pos_end: 4893,
    idx: 680, name: "NSLDS TEACH Grant School Code (1)", path: ["teach","grant","by_index",1,"School_Code"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_681 = {len: 2, pos_start: 4893, pos_end: 4895,
    idx: 681, name: "NSLDS TEACH Grant Transaction Number (1)", path: ["teach","grant","by_index",1,"Transaction_Number"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_682 = {len: 8, pos_start: 4895, pos_end: 4903,
    idx: 682, name: "NSLDS TEACH Grant Last Disbursement Date (1)", path: ["teach","grant","by_index",1,"Last_Disbursement_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_683 = {len: 6, pos_start: 4903, pos_end: 4909,
    idx: 683, name: "NSLDS TEACH Grant Scheduled Amount (1)", path: ["teach","grant","by_index",1,"Scheduled_Amount"], 
    extra: ["Whole dollar amount with leading zeros."],
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_684 = {len: 6, pos_start: 4909, pos_end: 4915,
    idx: 684, name: "NSLDS TEACH Grant Amount Paid to Date (1)", path: ["teach","grant","by_index",1,"Amount_Paid_to_Date"], 
    extra: ["Whole dollar amount with leading zeros."],
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_685 = {len: 6, pos_start: 4915, pos_end: 4921,
    idx: 685, name: "NSLDS TEACH Grant Award Amount (1)", path: ["teach","grant","by_index",1,"Award_Amount"], 
    extra: ["Whole dollar amount with leading zeros."],
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_686 = {len: 1, pos_start: 4921, pos_end: 4922,
    idx: 686, name: "NSLDS TEACH Grant Academic Year Level (1)", path: ["teach","grant","by_index",1,"Academic_Year_Level"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_687 = {len: 4, pos_start: 4922, pos_end: 4926,
    idx: 687, name: "NSLDS TEACH Grant Award Year (1)", path: ["teach","grant","by_index",1,"Award_Year"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_688 = {len: 1, pos_start: 4926, pos_end: 4927,
    idx: 688, name: "NSLDS TEACH Grant Loan Conversion Flag (1)", path: ["teach","grant","by_index",1,"Loan_Conversion_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_689 = {len: 4, pos_start: 4927, pos_end: 4931,
    idx: 689, name: "NSLDS TEACH Grant Discharge Code (1)", path: ["teach","grant","by_index",1,"Discharge_Code"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "HC02": "Coronavirus",
        "N/A": "N/A",
      }},
    ],
    note: [
        "HC02 = Coronavirus",
        "N/A",
        "Blank"
    ]};

export const field_690 = {len: 6, pos_start: 4931, pos_end: 4937,
    idx: 690, name: "NSLDS TEACH Grant Discharge Amount (1)", path: ["teach","grant","by_index",1,"Discharge_Amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
    ],
    note: [
        "000000 to 999999",
        "Blank"
    ]};

export const field_691 = {len: 6, pos_start: 4937, pos_end: 4943,
    idx: 691, name: "NSLDS-TEACH Grant Adjusted Disbursement (1)", path: ["teach","grant","by_index",1,"Adjusted_Disbursement"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
    ],
    note: [
        "000000 to 999999",
        "Blank"
    ]};

export const field_692 = {len: 20, pos_start: 4943, pos_end: 4963,
    idx: 692, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};

export const field_693 = {len: 2, pos_start: 4963, pos_end: 4965,
    idx: 693, name: "NSLDS TEACH Grant Sequence (2)", path: ["teach","grant","by_index",2,"Sequence"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"01","max":"03"},
    ],
    note: [
        "01 to 03",
        "Blank"
    ]};

export const field_694 = {len: 8, pos_start: 4965, pos_end: 4973,
    idx: 694, name: "NSLDS TEACH Grant School Code (2)", path: ["teach","grant","by_index",2,"School_Code"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_695 = {len: 2, pos_start: 4973, pos_end: 4975,
    idx: 695, name: "NSLDS TEACH Grant Transaction Number (2)", path: ["teach","grant","by_index",2,"Transaction_Number"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_696 = {len: 8, pos_start: 4975, pos_end: 4983,
    idx: 696, name: "NSLDS TEACH Grant Last Disbursement Date (2)", path: ["teach","grant","by_index",2,"Last_Disbursement_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_697 = {len: 6, pos_start: 4983, pos_end: 4989,
    idx: 697, name: "NSLDS TEACH Grant Scheduled Amount (2)", path: ["teach","grant","by_index",2,"Scheduled_Amount"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_698 = {len: 6, pos_start: 4989, pos_end: 4995,
    idx: 698, name: "NSLDS TEACH Grant Amount Paid to Date (2)", path: ["teach","grant","by_index",2,"Amount_Paid_to_Date"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_699 = {len: 6, pos_start: 4995, pos_end: 5001,
    idx: 699, name: "NSLDS TEACH Grant Award Amount (2)", path: ["teach","grant","by_index",2,"Award_Amount"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_700 = {len: 1, pos_start: 5001, pos_end: 5002,
    idx: 700, name: "NSLDS TEACH Grant Academic Year Level (2)", path: ["teach","grant","by_index",2,"Academic_Year_Level"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_701 = {len: 4, pos_start: 5002, pos_end: 5006,
    idx: 701, name: "NSLDS TEACH Grant Award Year (2)", path: ["teach","grant","by_index",2,"Award_Year"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_702 = {len: 1, pos_start: 5006, pos_end: 5007,
    idx: 702, name: "NSLDS TEACH Grant Loan Conversion Flag (2)", path: ["teach","grant","by_index",2,"Loan_Conversion_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_703 = {len: 4, pos_start: 5007, pos_end: 5011,
    idx: 703, name: "NSLDS TEACH Grant Discharge Code (2)", path: ["teach","grant","by_index",2,"Discharge_Code"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "HC02": "Coronavirus",
        "N/A": "N/A",
      }},
    ],
    note: [
        "HC02 = Coronavirus",
        "N/A",
        "Blank"
    ]};

export const field_704 = {len: 6, pos_start: 5011, pos_end: 5017,
    idx: 704, name: "NSLDS TEACH Grant Discharge Amount (2)", path: ["teach","grant","by_index",2,"Discharge_Amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
    ],
    note: [
        "000000 to 999999",
        "Blank"
    ]};

export const field_705 = {len: 6, pos_start: 5017, pos_end: 5023,
    idx: 705, name: "NSLDS-TEACH Grant Adjusted Disbursement (2)", path: ["teach","grant","by_index",2,"Adjusted_Disbursement"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
    ],
    note: [
        "000000 to 999999",
        "Blank"
    ]};

export const field_706 = {len: 20, pos_start: 5023, pos_end: 5043,
    idx: 706, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};

export const field_707 = {len: 2, pos_start: 5043, pos_end: 5045,
    idx: 707, name: "NSLDS TEACH Grant Sequence (3)", path: ["teach","grant","by_index",3,"Sequence"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"01","max":"03"},
    ],
    note: [
        "01 to 03",
        "Blank"
    ]};

export const field_708 = {len: 8, pos_start: 5045, pos_end: 5053,
    idx: 708, name: "NSLDS TEACH Grant School Code (3)", path: ["teach","grant","by_index",3,"School_Code"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_709 = {len: 2, pos_start: 5053, pos_end: 5055,
    idx: 709, name: "NSLDS TEACH Grant Transaction Number (3)", path: ["teach","grant","by_index",3,"Transaction_Number"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_710 = {len: 8, pos_start: 5055, pos_end: 5063,
    idx: 710, name: "NSLDS TEACH Grant Last Disbursement Date (3)", path: ["teach","grant","by_index",3,"Last_Disbursement_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_711 = {len: 6, pos_start: 5063, pos_end: 5069,
    idx: 711, name: "NSLDS TEACH Grant Scheduled Amount (3)", path: ["teach","grant","by_index",3,"Scheduled_Amount"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_712 = {len: 6, pos_start: 5069, pos_end: 5075,
    idx: 712, name: "NSLDS TEACH Grant Amount Paid to Date (3)", path: ["teach","grant","by_index",3,"Amount_Paid_to_Date"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_713 = {len: 6, pos_start: 5075, pos_end: 5081,
    idx: 713, name: "NSLDS TEACH Grant Award Amount (3)", path: ["teach","grant","by_index",3,"Award_Amount"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_714 = {len: 1, pos_start: 5081, pos_end: 5082,
    idx: 714, name: "NSLDS TEACH Grant Academic Year Level (3)", path: ["teach","grant","by_index",3,"Academic_Year_Level"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_715 = {len: 4, pos_start: 5082, pos_end: 5086,
    idx: 715, name: "NSLDS TEACH Grant Award Year (3)", path: ["teach","grant","by_index",3,"Award_Year"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
    ],
    note: [
        "Numeric",
        "Blank"
    ]};

export const field_716 = {len: 1, pos_start: 5086, pos_end: 5087,
    idx: 716, name: "NSLDS TEACH Grant Loan Conversion Flag (3)", path: ["teach","grant","by_index",3,"Loan_Conversion_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_717 = {len: 4, pos_start: 5087, pos_end: 5091,
    idx: 717, name: "NSLDS TEACH Grant Discharge Code (3)", path: ["teach","grant","by_index",3,"Discharge_Code"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "HC02": "Coronavirus",
        "N/A": "N/A",
      }},
    ],
    note: [
        "HC02 = Coronavirus",
        "N/A",
        "Blank"
    ]};

export const field_718 = {len: 6, pos_start: 5091, pos_end: 5097,
    idx: 718, name: "NSLDS TEACH Grant Discharge Amount (3)", path: ["teach","grant","by_index",3,"Discharge_Amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
    ],
    note: [
        "000000 to 999999",
        "Blank"
    ]};

export const field_719 = {len: 6, pos_start: 5097, pos_end: 5103,
    idx: 719, name: "NSLDS-TEACH Grant Adjusted Disbursement (3)", path: ["teach","grant","by_index",3,"Adjusted_Disbursement"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
    ],
    note: [
        "000000 to 999999",
        "Blank"
    ]};

export const field_720 = {len: 20, pos_start: 5103, pos_end: 5123,
    idx: 720, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};

export const field_721 = {len: 2, pos_start: 5123, pos_end: 5125,
    idx: 721, name: "NSLDS Loan Sequence Number (1)", path: ["loan","by_index",1,"Sequence_Number"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"01","max":"06"},
    ],
    note: [
        "01 to 06",
        "Blank"
    ]};

export const field_722 = {len: 1, pos_start: 5125, pos_end: 5126,
    idx: 722, name: "NSLDS Loan Defaulted Recent Indicator (1)", path: ["loan","by_index",1,"Defaulted_Recent_Indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "D": "Defaulted",
        "R": "Recent",
        "T": "Discharged",
        "F": "Fraud",
      }},
    ],
    note: [
        "D = Defaulted",
        "R = Recent",
        "T = Discharged",
        "F = Fraud",
        "Blank"
    ]};

export const field_723 = {len: 1, pos_start: 5126, pos_end: 5127,
    idx: 723, name: "NSLDS Loan Change Flag (1)", path: ["loan","by_index",1,"Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "#": "Changed",
        "N": "Did not change",
      }},
    ],
    note: [
        "# = Changed",
        "N = Did not change"
    ]};

export const field_724 = {len: 2, pos_start: 5127, pos_end: 5129,
    idx: 724, name: "NSLDS Loan Type Code (1)", path: ["loan","by_index",1,"Type_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alpha Code",
        "Blank",
        "See “NSLDS Loan Program Codes” in the FAFSA® Specifications Guide, Volume 4, Record Layouts and Processing Codes"
    ]};

export const field_725 = {len: 6, pos_start: 5129, pos_end: 5135,
    idx: 725, name: "NSLDS Loan Net Amount (1)", path: ["loan","by_index",1,"Net_Amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
    ],
    note: [
        "000000 to 999999",
        "Blank"
    ]};

export const field_726 = {len: 2, pos_start: 5135, pos_end: 5137,
    idx: 726, name: "NSLDS Loan Current Status Code (1)", path: ["loan","by_index",1,"Current_Status_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alpha Code",
        "Blank",
        "See “NSLDS Loan Current Status Codes” in the FAFSA® Specifications Guide, Volume 4, Record Layouts and Processing Codes"
    ]};

export const field_727 = {len: 8, pos_start: 5137, pos_end: 5145,
    idx: 727, name: "NSLDS Loan Current Status Date (1)", path: ["loan","by_index",1,"Current_Status_Date"], 
    validate: _validate_date,
    "allow_blank":true,"options":[{"op":"date"}],
    note: [
        "Format is CCYYMMDD",
        "Blank"
    ]};

export const field_728 = {len: 6, pos_start: 5145, pos_end: 5151,
    idx: 728, name: "NSLDS Loan Outstanding Principal Balance (1)", path: ["loan","by_index",1,"Outstanding_Principal_Balance"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "000000 to 999999",
        "N/A",
        "Blank"
    ]};

export const field_729 = {len: 8, pos_start: 5151, pos_end: 5159,
    idx: 729, name: "NSLDS Loan Outstanding Principal Balance Date (1)", path: ["loan","by_index",1,"Outstanding_Principal_Balance_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_730 = {len: 8, pos_start: 5159, pos_end: 5167,
    idx: 730, name: "NSLDS Loan Period Begin Date (1)", path: ["loan","by_index",1,"Period_Begin_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_731 = {len: 8, pos_start: 5167, pos_end: 5175,
    idx: 731, name: "NSLDS Loan Period End Date (1)", path: ["loan","by_index",1,"Period_End_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_732 = {len: 3, pos_start: 5175, pos_end: 5178,
    idx: 732, name: "NSLDS Loan Guaranty Agency Code (1)", path: ["loan","by_index",1,"Guaranty_Agency_Code"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_733 = {len: 3, pos_start: 5178, pos_end: 5181,
    idx: 733, name: "NSLDS Loan Contact Type (1)", path: ["loan","by_index",1,"Contact_Type"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "SCH": "School",
        "LEN": "Lender",
        "EDR": "ED region",
        "GA": "Guaranty agency or federal loan servicer",
        "LNS": "Lender servicer",
        "DDP": "Disability data provider",
        "RDS": "U.S. Department of Education",
        "N/A": "N/A",
      }},
    ],
    note: [
        "SCH = School",
        "LEN = Lender",
        "EDR = ED region",
        "GA = Guaranty agency or federal loan servicer",
        "LNS = Lender servicer",
        "DDP = Disability data provider",
        "RDS = U.S. Department of Education",
        "N/A",
        "Blank"
    ]};

export const field_734 = {len: 8, pos_start: 5181, pos_end: 5189,
    idx: 734, name: "NSLDS Loan School Code (1)", path: ["loan","by_index",1,"School_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_735 = {len: 8, pos_start: 5189, pos_end: 5197,
    idx: 735, name: "NSLDS Loan Contact Code (1)", path: ["loan","by_index",1,"Contact_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_736 = {len: 3, pos_start: 5197, pos_end: 5200,
    idx: 736, name: "NSLDS Loan Grade Level (1)", path: ["loan","by_index",1,"Grade_Level"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_737 = {len: 1, pos_start: 5200, pos_end: 5201,
    idx: 737, name: "NSLDS Loan Additional Unsubsidized Flag (1)", path: ["loan","by_index",1,"Additional_Unsubsidized_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "P": "PLUS denial",
        "H": "Health professional",
        "B": "Both",
        "N": "Neither",
      }},
    ],
    note: [
        "P = PLUS denial",
        "H = Health professional",
        "B = Both",
        "N = Neither",
        "Blank"
    ]};

export const field_738 = {len: 1, pos_start: 5201, pos_end: 5202,
    idx: 738, name: "NSLDS Loan Capitalized Interest Flag (1)", path: ["loan","by_index",1,"Capitalized_Interest_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_739 = {len: 6, pos_start: 5202, pos_end: 5208,
    idx: 739, name: "NSLDS Loan Disbursement Amount (1)", path: ["loan","by_index",1,"Disbursement_Amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "000000 to 999999",
        "N/A",
        "Blank"
    ]};

export const field_740 = {len: 8, pos_start: 5208, pos_end: 5216,
    idx: 740, name: "NSLDS Loan Disbursement Date (1)", path: ["loan","by_index",1,"Disbursement_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_741 = {len: 1, pos_start: 5216, pos_end: 5217,
    idx: 741, name: "NSLDS Loan Confirmed Loan Subsidy Status (1)", path: ["loan","by_index",1,"Confirmed_Loan_Subsidy_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "L": "Lost Subsidy",
        "R": "Reinstated Subsidy",
        "N": "Not Applicable",
      }},
    ],
    note: [
        "L = Lost Subsidy",
        "R = Reinstated Subsidy",
        "N = Not Applicable",
        "Blank"
    ]};

export const field_742 = {len: 8, pos_start: 5217, pos_end: 5225,
    idx: 742, name: "NSLDS Loan Confirmed Loan Subsidy Status Date (1)", path: ["loan","by_index",1,"Confirmed_Loan_Subsidy_Status_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_743 = {len: 20, pos_start: 5225, pos_end: 5245,
    idx: 743, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};

export const field_744 = {len: 2, pos_start: 5245, pos_end: 5247,
    idx: 744, name: "NSLDS Loan Sequence Number (2)", path: ["loan","by_index",2,"Sequence_Number"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"01","max":"06"},
    ],
    note: [
        "01 to 06",
        "Blank"
    ]};

export const field_745 = {len: 1, pos_start: 5247, pos_end: 5248,
    idx: 745, name: "NSLDS Loan Defaulted Recent Indicator (2)", path: ["loan","by_index",2,"Defaulted_Recent_Indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "D": "Defaulted",
        "R": "Recent",
        "T": "Discharged",
        "F": "Fraud",
      }},
    ],
    note: [
        "D = Defaulted",
        "R = Recent",
        "T = Discharged",
        "F = Fraud",
        "Blank"
    ]};

export const field_746 = {len: 1, pos_start: 5248, pos_end: 5249,
    idx: 746, name: "NSLDS Loan Change Flag (2)", path: ["loan","by_index",2,"Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "#": "Changed",
        "N": "Did not change",
      }},
    ],
    note: [
        "# = Changed",
        "N = Did not change"
    ]};

export const field_747 = {len: 2, pos_start: 5249, pos_end: 5251,
    idx: 747, name: "NSLDS Loan Type Code (2)", path: ["loan","by_index",2,"Type_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alpha Code",
        "Blank",
        "See “NSLDS Loan Program Codes” in the FAFSA® Specifications Guide, Volume 4, Record Layouts and Processing Codes"
    ]};

export const field_748 = {len: 6, pos_start: 5251, pos_end: 5257,
    idx: 748, name: "NSLDS Loan Net Amount (2)", path: ["loan","by_index",2,"Net_Amount"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alpha Code",
        "Blank",
        "See “NSLDS Loan Current Status Codes” in the FAFSA® Specifications Guide, Volume 4, Record Layouts and Processing Codes"
    ]};

export const field_749 = {len: 2, pos_start: 5257, pos_end: 5259,
    idx: 749, name: "NSLDS Loan Current Status Code (2)", path: ["loan","by_index",2,"Current_Status_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alpha Code",
        "Blank",
        "See “NSLDS Loan Current Status Codes” in the FAFSA® Specifications Guide, Volume 4, Record Layouts and Processing Codes"
    ]};

export const field_750 = {len: 8, pos_start: 5259, pos_end: 5267,
    idx: 750, name: "NSLDS Loan Current Status Date (2)", path: ["loan","by_index",2,"Current_Status_Date"], 
    validate: _validate_date,
    "allow_blank":true,"options":[{"op":"date"}],
    note: [
        "Format is CCYYMMDD",
        "Blank"
    ]};

export const field_751 = {len: 6, pos_start: 5267, pos_end: 5273,
    idx: 751, name: "NSLDS Loan Outstanding Principal Balance (2)", path: ["loan","by_index",2,"Outstanding_Principal_Balance"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "000000 to 999999",
        "N/A",
        "Blank"
    ]};

export const field_752 = {len: 8, pos_start: 5273, pos_end: 5281,
    idx: 752, name: "NSLDS Loan Outstanding Principal Balance Date (2)", path: ["loan","by_index",2,"Outstanding_Principal_Balance_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_753 = {len: 8, pos_start: 5281, pos_end: 5289,
    idx: 753, name: "NSLDS Loan Period Begin Date (2)", path: ["loan","by_index",2,"Period_Begin_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_754 = {len: 8, pos_start: 5289, pos_end: 5297,
    idx: 754, name: "NSLDS Loan Period End Date (2)", path: ["loan","by_index",2,"Period_End_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_755 = {len: 3, pos_start: 5297, pos_end: 5300,
    idx: 755, name: "NSLDS Loan Guaranty Agency Code (2)", path: ["loan","by_index",2,"Guaranty_Agency_Code"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_756 = {len: 3, pos_start: 5300, pos_end: 5303,
    idx: 756, name: "NSLDS Loan Contact Type (2)", path: ["loan","by_index",2,"Contact_Type"], 
    validate: _validate_options,
    options: [
      {op: "alpha", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alpha",
        "N/A",
        "Blank"
    ]};

export const field_757 = {len: 8, pos_start: 5303, pos_end: 5311,
    idx: 757, name: "NSLDS Loan School Code (2)", path: ["loan","by_index",2,"School_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_758 = {len: 8, pos_start: 5311, pos_end: 5319,
    idx: 758, name: "NSLDS Loan Contact Code (2)", path: ["loan","by_index",2,"Contact_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_759 = {len: 3, pos_start: 5319, pos_end: 5322,
    idx: 759, name: "NSLDS Loan Grade Level (2)", path: ["loan","by_index",2,"Grade_Level"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_760 = {len: 1, pos_start: 5322, pos_end: 5323,
    idx: 760, name: "NSLDS Loan Additional Unsubsidized Flag (2)", path: ["loan","by_index",2,"Additional_Unsubsidized_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "P": "PLUS denial",
        "H": "Health professional",
        "B": "Both",
        "N": "Neither",
      }},
    ],
    note: [
        "P = PLUS denial",
        "H = Health professional",
        "B = Both",
        "N = Neither",
        "Blank"
    ]};

export const field_761 = {len: 1, pos_start: 5323, pos_end: 5324,
    idx: 761, name: "NSLDS Loan Capitalized Interest Flag (2)", path: ["loan","by_index",2,"Capitalized_Interest_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_762 = {len: 6, pos_start: 5324, pos_end: 5330,
    idx: 762, name: "NSLDS Loan Disbursement Amount (2)", path: ["loan","by_index",2,"Disbursement_Amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "000000 to 999999",
        "N/A",
        "Blank"
    ]};

export const field_763 = {len: 8, pos_start: 5330, pos_end: 5338,
    idx: 763, name: "NSLDS Loan Disbursement Date (2)", path: ["loan","by_index",2,"Disbursement_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_764 = {len: 1, pos_start: 5338, pos_end: 5339,
    idx: 764, name: "NSLDS Loan Confirmed Loan Subsidy Status (2)", path: ["loan","by_index",2,"Confirmed_Loan_Subsidy_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "L": "Lost Subsidy",
        "R": "Reinstated Subsidy",
        "N": "Not Applicable",
      }},
    ],
    note: [
        "L = Lost Subsidy",
        "R = Reinstated Subsidy",
        "N = Not Applicable",
        "Blank"
    ]};

export const field_765 = {len: 8, pos_start: 5339, pos_end: 5347,
    idx: 765, name: "NSLDS Loan Confirmed Loan Subsidy Status Date (2)", path: ["loan","by_index",2,"Confirmed_Loan_Subsidy_Status_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_766 = {len: 20, pos_start: 5347, pos_end: 5367,
    idx: 766, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};

export const field_767 = {len: 2, pos_start: 5367, pos_end: 5369,
    idx: 767, name: "NSLDS Loan Sequence Number (3)", path: ["loan","by_index",3,"Sequence_Number"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"01","max":"06"},
    ],
    note: [
        "01 to 06",
        "Blank"
    ]};

export const field_768 = {len: 1, pos_start: 5369, pos_end: 5370,
    idx: 768, name: "NSLDS Loan Defaulted Recent Indicator (3)", path: ["loan","by_index",3,"Defaulted_Recent_Indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "D": "Defaulted",
        "R": "Recent",
        "T": "Discharged",
        "F": "Fraud",
      }},
    ],
    note: [
        "D = Defaulted",
        "R = Recent",
        "T = Discharged",
        "F = Fraud",
        "Blank"
    ]};

export const field_769 = {len: 1, pos_start: 5370, pos_end: 5371,
    idx: 769, name: "NSLDS Loan Change Flag (3)", path: ["loan","by_index",3,"Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "#": "Changed",
        "N": "Did not change",
      }},
    ],
    note: [
        "# = Changed",
        "N = Did not change"
    ]};

export const field_770 = {len: 2, pos_start: 5371, pos_end: 5373,
    idx: 770, name: "NSLDS Loan Type Code (3)", path: ["loan","by_index",3,"Type_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alpha Code",
        "Blank",
        "See “NSLDS Loan Program Codes” in the FAFSA® Specifications Guide, Volume 4, Record Layouts and Processing Codes"
    ]};

export const field_771 = {len: 6, pos_start: 5373, pos_end: 5379,
    idx: 771, name: "NSLDS Loan Net Amount (3)", path: ["loan","by_index",3,"Net_Amount"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alpha Code",
        "Blank",
        "See “NSLDS Loan Current Status Codes” in the FAFSA® Specifications Guide, Volume 4, Record Layouts and Processing Codes"
    ]};

export const field_772 = {len: 2, pos_start: 5379, pos_end: 5381,
    idx: 772, name: "NSLDS Loan Current Status Code (3)", path: ["loan","by_index",3,"Current_Status_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alpha Code",
        "Blank",
        "See “NSLDS Loan Current Status Codes” in the FAFSA® Specifications Guide, Volume 4, Record Layouts and Processing Codes"
    ]};

export const field_773 = {len: 8, pos_start: 5381, pos_end: 5389,
    idx: 773, name: "NSLDS Loan Current Status Date (3)", path: ["loan","by_index",3,"Current_Status_Date"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alpha Code",
        "Blank",
        "See “NSLDS Loan Current Status Codes” in the FAFSA® Specifications Guide, Volume 4, Record Layouts and Processing Codes"
    ]};

export const field_774 = {len: 6, pos_start: 5389, pos_end: 5395,
    idx: 774, name: "NSLDS Loan Outstanding Principal Balance (3)", path: ["loan","by_index",3,"Outstanding_Principal_Balance"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "000000 to 999999",
        "N/A",
        "Blank"
    ]};

export const field_775 = {len: 8, pos_start: 5395, pos_end: 5403,
    idx: 775, name: "NSLDS Loan Outstanding Principal Balance Date (3)", path: ["loan","by_index",3,"Outstanding_Principal_Balance_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_776 = {len: 8, pos_start: 5403, pos_end: 5411,
    idx: 776, name: "NSLDS Loan Period Begin Date (3)", path: ["loan","by_index",3,"Period_Begin_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_777 = {len: 8, pos_start: 5411, pos_end: 5419,
    idx: 777, name: "NSLDS Loan Period End Date (3)", path: ["loan","by_index",3,"Period_End_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_778 = {len: 3, pos_start: 5419, pos_end: 5422,
    idx: 778, name: "NSLDS Loan Guaranty Agency Code (3)", path: ["loan","by_index",3,"Guaranty_Agency_Code"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_779 = {len: 3, pos_start: 5422, pos_end: 5425,
    idx: 779, name: "NSLDS Loan Contact Type (3)", path: ["loan","by_index",3,"Contact_Type"], 
    validate: _validate_options,
    options: [
      {op: "alpha", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alpha",
        "N/A",
        "Blank"
    ]};

export const field_780 = {len: 8, pos_start: 5425, pos_end: 5433,
    idx: 780, name: "NSLDS Loan School Code (3)", path: ["loan","by_index",3,"School_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_781 = {len: 8, pos_start: 5433, pos_end: 5441,
    idx: 781, name: "NSLDS Loan Contact Code (3)", path: ["loan","by_index",3,"Contact_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_782 = {len: 3, pos_start: 5441, pos_end: 5444,
    idx: 782, name: "NSLDS Loan Grade Level (3)", path: ["loan","by_index",3,"Grade_Level"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_783 = {len: 1, pos_start: 5444, pos_end: 5445,
    idx: 783, name: "NSLDS Loan Additional Unsubsidized Flag (3)", path: ["loan","by_index",3,"Additional_Unsubsidized_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "P": "PLUS denial",
        "H": "Health professional",
        "B": "Both",
        "N": "Neither",
      }},
    ],
    note: [
        "P = PLUS denial",
        "H = Health professional",
        "B = Both",
        "N = Neither",
        "Blank"
    ]};

export const field_784 = {len: 1, pos_start: 5445, pos_end: 5446,
    idx: 784, name: "NSLDS Loan Capitalized Interest Flag (3)", path: ["loan","by_index",3,"Capitalized_Interest_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_785 = {len: 6, pos_start: 5446, pos_end: 5452,
    idx: 785, name: "NSLDS Loan Disbursement Amount (3)", path: ["loan","by_index",3,"Disbursement_Amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "000000 to 999999",
        "N/A",
        "Blank"
    ]};

export const field_786 = {len: 8, pos_start: 5452, pos_end: 5460,
    idx: 786, name: "NSLDS Loan Disbursement Date (3)", path: ["loan","by_index",3,"Disbursement_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_787 = {len: 1, pos_start: 5460, pos_end: 5461,
    idx: 787, name: "NSLDS Loan Confirmed Loan Subsidy Status (3)", path: ["loan","by_index",3,"Confirmed_Loan_Subsidy_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "L": "Lost Subsidy",
        "R": "Reinstated Subsidy",
        "N": "Not Applicable",
      }},
    ],
    note: [
        "L = Lost Subsidy",
        "R = Reinstated Subsidy",
        "N = Not Applicable",
        "Blank"
    ]};

export const field_788 = {len: 8, pos_start: 5461, pos_end: 5469,
    idx: 788, name: "NSLDS Loan Confirmed Loan Subsidy Status Date (3)", path: ["loan","by_index",3,"Confirmed_Loan_Subsidy_Status_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_789 = {len: 20, pos_start: 5469, pos_end: 5489,
    idx: 789, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};

export const field_790 = {len: 2, pos_start: 5489, pos_end: 5491,
    idx: 790, name: "NSLDS Loan Sequence Number (4)", path: ["loan","by_index",4,"Sequence_Number"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"01","max":"06"},
    ],
    note: [
        "01 to 06",
        "Blank"
    ]};

export const field_791 = {len: 1, pos_start: 5491, pos_end: 5492,
    idx: 791, name: "NSLDS Loan Defaulted Recent Indicator (4)", path: ["loan","by_index",4,"Defaulted_Recent_Indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "D": "Defaulted",
        "R": "Recent",
        "T": "Discharged",
        "F": "Fraud",
      }},
    ],
    note: [
        "D = Defaulted",
        "R = Recent",
        "T = Discharged",
        "F = Fraud",
        "Blank"
    ]};

export const field_792 = {len: 1, pos_start: 5492, pos_end: 5493,
    idx: 792, name: "NSLDS Loan Change Flag (4)", path: ["loan","by_index",4,"Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "#": "Changed",
        "N": "Did not change",
      }},
    ],
    note: [
        "# = Changed",
        "N = Did not change"
    ]};

export const field_793 = {len: 2, pos_start: 5493, pos_end: 5495,
    idx: 793, name: "NSLDS Loan Type Code (4)", path: ["loan","by_index",4,"Type_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alpha Code",
        "Blank",
        "See “NSLDS Loan Program Codes” in the FAFSA® Specifications Guide, Volume 4, Record Layouts and Processing Codes"
    ]};

export const field_794 = {len: 6, pos_start: 5495, pos_end: 5501,
    idx: 794, name: "NSLDS Loan Net Amount (4)", path: ["loan","by_index",4,"Net_Amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
    ],
    note: [
        "000000 to 999999",
        "Blank"
    ]};

export const field_795 = {len: 2, pos_start: 5501, pos_end: 5503,
    idx: 795, name: "NSLDS Loan Current Status Code (4)", path: ["loan","by_index",4,"Current_Status_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alpha Code",
        "Blank",
        "See “NSLDS Loan Current Status Codes” in the FAFSA® Specifications Guide, Volume 4, Record Layouts and Processing Codes"
    ]};

export const field_796 = {len: 8, pos_start: 5503, pos_end: 5511,
    idx: 796, name: "NSLDS Loan Current Status Date (4)", path: ["loan","by_index",4,"Current_Status_Date"], 
    validate: _validate_date,
    "allow_blank":true,"options":[{"op":"date"}],
    note: [
        "Format is CCYYMMDD",
        "Blank"
    ]};

export const field_797 = {len: 6, pos_start: 5511, pos_end: 5517,
    idx: 797, name: "NSLDS Loan Outstanding Principal Balance (4)", path: ["loan","by_index",4,"Outstanding_Principal_Balance"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "000000 to 999999",
        "N/A",
        "Blank"
    ]};

export const field_798 = {len: 8, pos_start: 5517, pos_end: 5525,
    idx: 798, name: "NSLDS Loan Outstanding Principal Balance Date (4)", path: ["loan","by_index",4,"Outstanding_Principal_Balance_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_799 = {len: 8, pos_start: 5525, pos_end: 5533,
    idx: 799, name: "NSLDS Loan Period Begin Date (4)", path: ["loan","by_index",4,"Period_Begin_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_800 = {len: 8, pos_start: 5533, pos_end: 5541,
    idx: 800, name: "NSLDS Loan Period End Date (4)", path: ["loan","by_index",4,"Period_End_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_801 = {len: 3, pos_start: 5541, pos_end: 5544,
    idx: 801, name: "NSLDS Loan Guaranty Agency Code (4)", path: ["loan","by_index",4,"Guaranty_Agency_Code"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_802 = {len: 3, pos_start: 5544, pos_end: 5547,
    idx: 802, name: "NSLDS Loan Contact Type (4)", path: ["loan","by_index",4,"Contact_Type"], 
    validate: _validate_options,
    options: [
      {op: "alpha", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alpha",
        "N/A",
        "Blank"
    ]};

export const field_803 = {len: 8, pos_start: 5547, pos_end: 5555,
    idx: 803, name: "NSLDS Loan School Code (4)", path: ["loan","by_index",4,"School_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_804 = {len: 8, pos_start: 5555, pos_end: 5563,
    idx: 804, name: "NSLDS Loan Contact Code (4)", path: ["loan","by_index",4,"Contact_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_805 = {len: 3, pos_start: 5563, pos_end: 5566,
    idx: 805, name: "NSLDS Loan Grade Level (4)", path: ["loan","by_index",4,"Grade_Level"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_806 = {len: 1, pos_start: 5566, pos_end: 5567,
    idx: 806, name: "NSLDS Loan Additional Unsubsidized Flag (4)", path: ["loan","by_index",4,"Additional_Unsubsidized_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "P": "PLUS denial",
        "H": "Health professional",
        "B": "Both",
        "N": "Neither",
      }},
    ],
    note: [
        "P = PLUS denial",
        "H = Health professional",
        "B = Both",
        "N = Neither",
        "Blank"
    ]};

export const field_807 = {len: 1, pos_start: 5567, pos_end: 5568,
    idx: 807, name: "NSLDS Loan Capitalized Interest Flag (4)", path: ["loan","by_index",4,"Capitalized_Interest_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_808 = {len: 6, pos_start: 5568, pos_end: 5574,
    idx: 808, name: "NSLDS Loan Disbursement Amount (4)", path: ["loan","by_index",4,"Disbursement_Amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "000000 to 999999",
        "N/A",
        "Blank"
    ]};

export const field_809 = {len: 8, pos_start: 5574, pos_end: 5582,
    idx: 809, name: "NSLDS Loan Disbursement Date (4)", path: ["loan","by_index",4,"Disbursement_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_810 = {len: 1, pos_start: 5582, pos_end: 5583,
    idx: 810, name: "NSLDS Loan Confirmed Loan Subsidy Status (4)", path: ["loan","by_index",4,"Confirmed_Loan_Subsidy_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "L": "Lost Subsidy",
        "R": "Reinstated Subsidy",
        "N": "Not Applicable",
      }},
    ],
    note: [
        "L = Lost Subsidy",
        "R = Reinstated Subsidy",
        "N = Not Applicable",
        "Blank"
    ]};

export const field_811 = {len: 8, pos_start: 5583, pos_end: 5591,
    idx: 811, name: "NSLDS Loan Confirmed Loan Subsidy Status Date (4)", path: ["loan","by_index",4,"Confirmed_Loan_Subsidy_Status_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_812 = {len: 20, pos_start: 5591, pos_end: 5611,
    idx: 812, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};

export const field_813 = {len: 2, pos_start: 5611, pos_end: 5613,
    idx: 813, name: "NSLDS Loan Sequence Number (5)", path: ["loan","by_index",5,"Sequence_Number"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"01","max":"06"},
    ],
    note: [
        "01 to 06",
        "Blank"
    ]};

export const field_814 = {len: 1, pos_start: 5613, pos_end: 5614,
    idx: 814, name: "NSLDS Loan Defaulted Recent Indicator (5)", path: ["loan","by_index",5,"Defaulted_Recent_Indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "D": "Defaulted",
        "R": "Recent",
        "T": "Discharged",
        "F": "Fraud",
      }},
    ],
    note: [
        "D = Defaulted",
        "R = Recent",
        "T = Discharged",
        "F = Fraud",
        "Blank"
    ]};

export const field_815 = {len: 1, pos_start: 5614, pos_end: 5615,
    idx: 815, name: "NSLDS Loan Change Flag (5)", path: ["loan","by_index",5,"Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "#": "Changed",
        "N": "Did not change",
      }},
    ],
    note: [
        "# = Changed",
        "N = Did not change"
    ]};

export const field_816 = {len: 2, pos_start: 5615, pos_end: 5617,
    idx: 816, name: "NSLDS Loan Type Code (5)", path: ["loan","by_index",5,"Type_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alpha Code",
        "Blank",
        "See “NSLDS Loan Program Codes” in the FAFSA® Specifications Guide, Volume 4, Record Layouts and Processing Codes"
    ]};

export const field_817 = {len: 6, pos_start: 5617, pos_end: 5623,
    idx: 817, name: "NSLDS Loan Net Amount (5)", path: ["loan","by_index",5,"Net_Amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
    ],
    note: [
        "000000 to 999999",
        "Blank"
    ]};

export const field_818 = {len: 2, pos_start: 5623, pos_end: 5625,
    idx: 818, name: "NSLDS Loan Current Status Code (5)", path: ["loan","by_index",5,"Current_Status_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alpha Code",
        "Blank",
        "See “NSLDS Loan Current Status Codes” in the FAFSA® Specifications Guide, Volume 4, Record Layouts and Processing Codes"
    ]};

export const field_819 = {len: 8, pos_start: 5625, pos_end: 5633,
    idx: 819, name: "NSLDS Loan Current Status Date (5)", path: ["loan","by_index",5,"Current_Status_Date"], 
    validate: _validate_date,
    "allow_blank":true,"options":[{"op":"date"}],
    note: [
        "Format is CCYYMMDD",
        "Blank"
    ]};

export const field_820 = {len: 6, pos_start: 5633, pos_end: 5639,
    idx: 820, name: "NSLDS Loan Outstanding Principal Balance (5)", path: ["loan","by_index",5,"Outstanding_Principal_Balance"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "000000 to 999999",
        "N/A",
        "Blank"
    ]};

export const field_821 = {len: 8, pos_start: 5639, pos_end: 5647,
    idx: 821, name: "NSLDS Loan Outstanding Principal Balance Date (5)", path: ["loan","by_index",5,"Outstanding_Principal_Balance_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_822 = {len: 8, pos_start: 5647, pos_end: 5655,
    idx: 822, name: "NSLDS Loan Period Begin Date (5)", path: ["loan","by_index",5,"Period_Begin_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_823 = {len: 8, pos_start: 5655, pos_end: 5663,
    idx: 823, name: "NSLDS Loan Period End Date (5)", path: ["loan","by_index",5,"Period_End_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_824 = {len: 3, pos_start: 5663, pos_end: 5666,
    idx: 824, name: "NSLDS Loan Guaranty Agency Code (5)", path: ["loan","by_index",5,"Guaranty_Agency_Code"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_825 = {len: 3, pos_start: 5666, pos_end: 5669,
    idx: 825, name: "NSLDS Loan Contact Type (5)", path: ["loan","by_index",5,"Contact_Type"], 
    validate: _validate_options,
    options: [
      {op: "alpha", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alpha",
        "N/A",
        "Blank"
    ]};

export const field_826 = {len: 8, pos_start: 5669, pos_end: 5677,
    idx: 826, name: "NSLDS Loan School Code (5)", path: ["loan","by_index",5,"School_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_827 = {len: 8, pos_start: 5677, pos_end: 5685,
    idx: 827, name: "NSLDS Loan Contact Code (5)", path: ["loan","by_index",5,"Contact_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_828 = {len: 3, pos_start: 5685, pos_end: 5688,
    idx: 828, name: "NSLDS Loan Grade Level (5)", path: ["loan","by_index",5,"Grade_Level"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_829 = {len: 1, pos_start: 5688, pos_end: 5689,
    idx: 829, name: "NSLDS Loan Additional Unsubsidized Flag (5)", path: ["loan","by_index",5,"Additional_Unsubsidized_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "P": "PLUS denial",
        "H": "Health professional",
        "B": "Both",
        "N": "Neither",
      }},
    ],
    note: [
        "P = PLUS denial",
        "H = Health professional",
        "B = Both",
        "N = Neither",
        "Blank"
    ]};

export const field_830 = {len: 1, pos_start: 5689, pos_end: 5690,
    idx: 830, name: "NSLDS Loan Capitalized Interest Flag (5)", path: ["loan","by_index",5,"Capitalized_Interest_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_831 = {len: 6, pos_start: 5690, pos_end: 5696,
    idx: 831, name: "NSLDS Loan Disbursement Amount (5)", path: ["loan","by_index",5,"Disbursement_Amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "000000 to 999999",
        "N/A",
        "Blank"
    ]};

export const field_832 = {len: 8, pos_start: 5696, pos_end: 5704,
    idx: 832, name: "NSLDS Loan Disbursement Date (5)", path: ["loan","by_index",5,"Disbursement_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_833 = {len: 1, pos_start: 5704, pos_end: 5705,
    idx: 833, name: "NSLDS Loan Confirmed Loan Subsidy Status (5)", path: ["loan","by_index",5,"Confirmed_Loan_Subsidy_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "L": "Lost Subsidy",
        "R": "Reinstated Subsidy",
        "N": "Not Applicable",
      }},
    ],
    note: [
        "L = Lost Subsidy",
        "R = Reinstated Subsidy",
        "N = Not Applicable",
        "Blank"
    ]};

export const field_834 = {len: 8, pos_start: 5705, pos_end: 5713,
    idx: 834, name: "NSLDS Loan Confirmed Loan Subsidy Status Date (5)", path: ["loan","by_index",5,"Confirmed_Loan_Subsidy_Status_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_835 = {len: 20, pos_start: 5713, pos_end: 5733,
    idx: 835, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};

export const field_836 = {len: 2, pos_start: 5733, pos_end: 5735,
    idx: 836, name: "NSLDS Loan Sequence Number (6)", path: ["loan","by_index",6,"Sequence_Number"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"01","max":"06"},
    ],
    note: [
        "01 to 06",
        "Blank"
    ]};

export const field_837 = {len: 1, pos_start: 5735, pos_end: 5736,
    idx: 837, name: "NSLDS Loan Defaulted Recent Indicator (6)", path: ["loan","by_index",6,"Defaulted_Recent_Indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "D": "Defaulted",
        "R": "Recent",
        "T": "Discharged",
        "F": "Fraud",
      }},
    ],
    note: [
        "D = Defaulted",
        "R = Recent",
        "T = Discharged",
        "F = Fraud",
        "Blank"
    ]};

export const field_838 = {len: 1, pos_start: 5736, pos_end: 5737,
    idx: 838, name: "NSLDS Loan Change Flag (6)", path: ["loan","by_index",6,"Change_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "#": "Changed",
        "N": "Did not change",
      }},
    ],
    note: [
        "# = Changed",
        "N = Did not change"
    ]};

export const field_839 = {len: 2, pos_start: 5737, pos_end: 5739,
    idx: 839, name: "NSLDS Loan Type Code (6)", path: ["loan","by_index",6,"Type_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alpha Code",
        "Blank",
        "See “NSLDS Loan Program Codes” in the FAFSA® Specifications Guide, Volume 4, Record Layouts and Processing Codes"
    ]};

export const field_840 = {len: 6, pos_start: 5739, pos_end: 5745,
    idx: 840, name: "NSLDS Loan Net Amount (6)", path: ["loan","by_index",6,"Net_Amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
    ],
    note: [
        "000000 to 999999",
        "Blank"
    ]};

export const field_841 = {len: 2, pos_start: 5745, pos_end: 5747,
    idx: 841, name: "NSLDS Loan Current Status Code (6)", path: ["loan","by_index",6,"Current_Status_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
    ],
    note: [
        "Alpha Code",
        "Blank",
        "See “NSLDS Loan Current Status Codes” in the FAFSA® Specifications Guide, Volume 4, Record Layouts and Processing Codes"
    ]};

export const field_842 = {len: 8, pos_start: 5747, pos_end: 5755,
    idx: 842, name: "NSLDS Loan Current Status Date (6)", path: ["loan","by_index",6,"Current_Status_Date"], 
    validate: _validate_date,
    "allow_blank":true,"options":[{"op":"date"}],
    note: [
        "Format is CCYYMMDD",
        "Blank"
    ]};

export const field_843 = {len: 6, pos_start: 5755, pos_end: 5761,
    idx: 843, name: "NSLDS Loan Outstanding Principal Balance (6)", path: ["loan","by_index",6,"Outstanding_Principal_Balance"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "000000 to 999999",
        "N/A",
        "Blank"
    ]};

export const field_844 = {len: 8, pos_start: 5761, pos_end: 5769,
    idx: 844, name: "NSLDS Loan Outstanding Principal Balance Date (6)", path: ["loan","by_index",6,"Outstanding_Principal_Balance_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_845 = {len: 8, pos_start: 5769, pos_end: 5777,
    idx: 845, name: "NSLDS Loan Period Begin Date (6)", path: ["loan","by_index",6,"Period_Begin_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_846 = {len: 8, pos_start: 5777, pos_end: 5785,
    idx: 846, name: "NSLDS Loan Period End Date (6)", path: ["loan","by_index",6,"Period_End_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_847 = {len: 3, pos_start: 5785, pos_end: 5788,
    idx: 847, name: "NSLDS Loan Guaranty Agency Code (6)", path: ["loan","by_index",6,"Guaranty_Agency_Code"], 
    validate: _validate_options,
    options: [
      {op: "numeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric",
        "N/A",
        "Blank"
    ]};

export const field_848 = {len: 3, pos_start: 5788, pos_end: 5791,
    idx: 848, name: "NSLDS Loan Contact Type (6)", path: ["loan","by_index",6,"Contact_Type"], 
    validate: _validate_options,
    options: [
      {op: "alpha", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alpha",
        "N/A",
        "Blank"
    ]};

export const field_849 = {len: 8, pos_start: 5791, pos_end: 5799,
    idx: 849, name: "NSLDS Loan School Code (6)", path: ["loan","by_index",6,"School_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_850 = {len: 8, pos_start: 5799, pos_end: 5807,
    idx: 850, name: "NSLDS Loan Contact Code (6)", path: ["loan","by_index",6,"Contact_Code"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_851 = {len: 3, pos_start: 5807, pos_end: 5810,
    idx: 851, name: "NSLDS Loan Grade Level (6)", path: ["loan","by_index",6,"Grade_Level"], 
    validate: _validate_options,
    options: [
      {op: "alphanumeric", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Alphanumeric",
        "N/A",
        "Blank"
    ]};

export const field_852 = {len: 1, pos_start: 5810, pos_end: 5811,
    idx: 852, name: "NSLDS Loan Additional Unsubsidized Flag (6)", path: ["loan","by_index",6,"Additional_Unsubsidized_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "P": "PLUS denial",
        "H": "Health professional",
        "B": "Both",
        "N": "Neither",
      }},
    ],
    note: [
        "P = PLUS denial",
        "H = Health professional",
        "B = Both",
        "N = Neither",
        "Blank"
    ]};

export const field_853 = {len: 1, pos_start: 5811, pos_end: 5812,
    idx: 853, name: "NSLDS Loan Capitalized Interest Flag (6)", path: ["loan","by_index",6,"Capitalized_Interest_Flag"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "Y": "Yes",
        "N": "No",
      }},
    ],
    note: [
        "Y = Yes",
        "N = No",
        "Blank"
    ]};

export const field_854 = {len: 6, pos_start: 5812, pos_end: 5818,
    idx: 854, name: "NSLDS Loan Disbursement Amount (6)", path: ["loan","by_index",6,"Disbursement_Amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"000000","max":"999999"},
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "000000 to 999999",
        "N/A",
        "Blank"
    ]};

export const field_855 = {len: 8, pos_start: 5818, pos_end: 5826,
    idx: 855, name: "NSLDS Loan Disbursement Date (6)", path: ["loan","by_index",6,"Disbursement_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_856 = {len: 1, pos_start: 5826, pos_end: 5827,
    idx: 856, name: "NSLDS Loan Confirmed Loan Subsidy Status (6)", path: ["loan","by_index",6,"Confirmed_Loan_Subsidy_Status"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "L": "Lost Subsidy",
        "R": "Reinstated Subsidy",
        "N": "Not Applicable",
      }},
    ],
    note: [
        "L = Lost Subsidy",
        "R = Reinstated Subsidy",
        "N = Not Applicable",
        "Blank"
    ]};

export const field_857 = {len: 8, pos_start: 5827, pos_end: 5835,
    idx: 857, name: "NSLDS Loan Confirmed Loan Subsidy Status Date (6)", path: ["loan","by_index",6,"Confirmed_Loan_Subsidy_Status_Date"], 
    validate: _validate_options,
    options: [
      {op: "date", },
      {op: "enum", options: {
        "N/A": "N/A",
      }},
    ],
    note: [
        "Numeric (CCYYMMDD)",
        "N/A",
        "Blank"
    ]};

export const field_858 = {len: 1164, pos_start: 5835, pos_end: 6999,
    idx: 858, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};


export const section_NSLDS = /* #__PURE__ */ {
    section: "NSLDS Information",
    path: ["NSLDS"],
    field_list: [field_583, field_584, field_585, field_586, field_587, field_588, field_589, field_590, field_591, field_592, field_593, field_594, field_595, field_596, field_597, field_598, field_599, field_600, field_601, field_602, field_603, field_604, field_605, field_606, field_607, field_608, field_609, field_610, field_611, field_612, field_613, field_614, field_615, field_616, field_617, field_618, field_619, field_620, field_621, field_622, field_623, field_624, field_625, field_626, field_627, field_628, field_629, field_630, field_631, field_632, field_633, field_634, field_635, field_636, field_637, field_638, field_639, field_640, field_641, field_642, field_643, field_644, field_645, field_646, field_647, field_648, field_649, field_650, field_651, field_652, field_653, field_654, field_655, field_656, field_657, field_658, field_659, field_660, field_661, field_662, field_663, field_664, field_665, field_666, field_667, field_668, field_669, field_670, field_671, field_672, field_673, field_674, field_675, field_676, field_677, field_678, field_679, field_680, field_681, field_682, field_683, field_684, field_685, field_686, field_687, field_688, field_689, field_690, field_691, field_692, field_693, field_694, field_695, field_696, field_697, field_698, field_699, field_700, field_701, field_702, field_703, field_704, field_705, field_706, field_707, field_708, field_709, field_710, field_711, field_712, field_713, field_714, field_715, field_716, field_717, field_718, field_719, field_720, field_721, field_722, field_723, field_724, field_725, field_726, field_727, field_728, field_729, field_730, field_731, field_732, field_733, field_734, field_735, field_736, field_737, field_738, field_739, field_740, field_741, field_742, field_743, field_744, field_745, field_746, field_747, field_748, field_749, field_750, field_751, field_752, field_753, field_754, field_755, field_756, field_757, field_758, field_759, field_760, field_761, field_762, field_763, field_764, field_765, field_766, field_767, field_768, field_769, field_770, field_771, field_772, field_773, field_774, field_775, field_776, field_777, field_778, field_779, field_780, field_781, field_782, field_783, field_784, field_785, field_786, field_787, field_788, field_789, field_790, field_791, field_792, field_793, field_794, field_795, field_796, field_797, field_798, field_799, field_800, field_801, field_802, field_803, field_804, field_805, field_806, field_807, field_808, field_809, field_810, field_811, field_812, field_813, field_814, field_815, field_816, field_817, field_818, field_819, field_820, field_821, field_822, field_823, field_824, field_825, field_826, field_827, field_828, field_829, field_830, field_831, field_832, field_833, field_834, field_835, field_836, field_837, field_838, field_839, field_840, field_841, field_842, field_843, field_844, field_845, field_846, field_847, field_848, field_849, field_850, field_851, field_852, field_853, field_854, field_855, field_856, field_857, field_858],
}


//*********************************************
// Section: FTIM Information
//

export const field_859 = {len: 36, pos_start: 6999, pos_end: 7035,
    idx: 859, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};


export const section_FTIM = /* #__PURE__ */ {
    section: "FTIM Information",
    path: ["FTIM"],
    field_list: [field_859],
}


//*********************************************
// Section: Student FTI-M Information
//

export const field_860 = {len: 50, pos_start: 7035, pos_end: 7085,
    idx: 860, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};

export const field_861 = {len: 11, pos_start: 7085, pos_end: 7096,
    idx: 861, name: null, 
    validate: _validate_expect,
    expect: "CUI//SP-TAX", non_content: true,
    note: [
        "Exact string: “CUI//SP-TAX”"
    ]};

export const field_862 = {len: 4, pos_start: 7096, pos_end: 7100,
    idx: 862, name: "Returned tax year", path: ["Returned_tax_year"], 
    validate: _validate_options,
    options: [
      {op: "year", },
    ],
    note: [
        "Year in format: “CCYY”",
        "Blank"
    ]};

export const field_863 = {len: 1, pos_start: 7100, pos_end: 7101,
    idx: 863, name: "Filing status code", path: ["Filing_status_code"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Single",
        "2": "Married–Filed Joint Return",
        "3": "Married–Filed Separate Return",
        "4": "Head of Household",
        "5": "Qualifying Surviving Spouse",
      }},
    ],
    note: [
        "1 = Single",
        "2 = Married–Filed Joint Return",
        "3 = Married–Filed Separate Return",
        "4 = Head of Household",
        "5 = Qualifying Surviving Spouse",
        "Blank"
    ]};

export const field_864 = {len: 10, pos_start: 7101, pos_end: 7111,
    idx: 864, name: "Adjusted Gross Income", path: ["Adjusted_Gross_Income"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-999999999","max":"9999999999"},
    ],
    note: [
        "-999999999 to 9999999999",
        "Blank"
    ]};

export const field_865 = {len: 2, pos_start: 7111, pos_end: 7113,
    idx: 865, name: "Number of exemptions", path: ["Number_of_exemptions"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99"},
    ],
    note: [
        "0 to 99",
        "Blank"
    ]};

export const field_866 = {len: 2, pos_start: 7113, pos_end: 7115,
    idx: 866, name: "Number of dependents", path: ["Number_of_dependents"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99"},
    ],
    note: [
        "0 to 99",
        "Blank"
    ]};

export const field_867 = {len: 11, pos_start: 7115, pos_end: 7126,
    idx: 867, name: "Total income earned amount", path: ["Total_income_earned_amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_868 = {len: 9, pos_start: 7126, pos_end: 7135,
    idx: 868, name: "Total tax paid amount", path: ["Total_tax_paid_amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999"},
    ],
    note: [
        "0 to 999999999",
        "Blank"
    ]};

export const field_869 = {len: 9, pos_start: 7135, pos_end: 7144,
    idx: 869, name: "Educational credits", path: ["Educational_credits"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999"},
    ],
    note: [
        "0 to 999999999",
        "Blank"
    ]};

export const field_870 = {len: 11, pos_start: 7144, pos_end: 7155,
    idx: 870, name: "Untaxed IRA distributions", path: ["Untaxed_IRA_distributions"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_871 = {len: 11, pos_start: 7155, pos_end: 7166,
    idx: 871, name: "IRA deductible and payments", path: ["IRA_deductible_and_payments"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_872 = {len: 11, pos_start: 7166, pos_end: 7177,
    idx: 872, name: "Tax exempt interest", path: ["Tax_exempt_interest"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_873 = {len: 11, pos_start: 7177, pos_end: 7188,
    idx: 873, name: "Untaxed pensions amount", path: ["Untaxed_pensions_amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_874 = {len: 12, pos_start: 7188, pos_end: 7200,
    idx: 874, name: "Schedule C net profit/loss", path: ["Schedule_C_net_profitloss"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-99999999999","max":"99999999999"},
    ],
    note: [
        "-99999999999 to 99999999999",
        "Blank"
    ]};

export const field_875 = {len: 1, pos_start: 7200, pos_end: 7201,
    idx: 875, name: "Schedule A indicator", path: ["Schedule_A_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_876 = {len: 1, pos_start: 7201, pos_end: 7202,
    idx: 876, name: "Schedule B indicator", path: ["Schedule_B_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_877 = {len: 1, pos_start: 7202, pos_end: 7203,
    idx: 877, name: "Schedule D indicator", path: ["Schedule_D_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_878 = {len: 1, pos_start: 7203, pos_end: 7204,
    idx: 878, name: "Schedule E indicator", path: ["Schedule_E_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_879 = {len: 1, pos_start: 7204, pos_end: 7205,
    idx: 879, name: "Schedule F indicator", path: ["Schedule_F_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_880 = {len: 1, pos_start: 7205, pos_end: 7206,
    idx: 880, name: "Schedule H indicator", path: ["Schedule_H_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_881 = {len: 3, pos_start: 7206, pos_end: 7209,
    idx: 881, name: "IRS response code", path: ["IRS_response_code"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "200": "Successful Request",
        "203": "PII Match Failed",
        "206": "Partial Delivery of Content",
        "212": "Cannot Verify Return Data",
        "214": "No Return on File",
      }},
    ],
    note: [
        "200 = Successful Request",
        "203 = PII Match Failed",
        "206 = Partial Delivery of Content",
        "212 = Cannot Verify Return Data",
        "214 = No Return on File"
    ]};


export const section_student_financial_ftim = /* #__PURE__ */ {
    section: "Student FTI-M Information",
    path: ["student","financial_ftim"],
    field_list: [field_860, field_861, field_862, field_863, field_864, field_865, field_866, field_867, field_868, field_869, field_870, field_871, field_872, field_873, field_874, field_875, field_876, field_877, field_878, field_879, field_880, field_881],
}


//*********************************************
// Section: Student Spouse FTI-M Information
//

export const field_882 = {len: 4, pos_start: 7209, pos_end: 7213,
    idx: 882, name: "Returned tax year", path: ["Returned_tax_year"], 
    validate: _validate_options,
    options: [
      {op: "year", },
    ],
    note: [
        "Year in format: “CCYY”",
        "Blank"
    ]};

export const field_883 = {len: 1, pos_start: 7213, pos_end: 7214,
    idx: 883, name: "Filing status code", path: ["Filing_status_code"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Single",
        "2": "Married–Filed Joint Return",
        "3": "Married–Filed Separate Return",
        "4": "Head of Household",
        "5": "Qualifying Surviving Spouse",
      }},
    ],
    note: [
        "1 = Single",
        "2 = Married–Filed Joint Return",
        "3 = Married–Filed Separate Return",
        "4 = Head of Household",
        "5 = Qualifying Surviving Spouse",
        "Blank"
    ]};

export const field_884 = {len: 10, pos_start: 7214, pos_end: 7224,
    idx: 884, name: "Adjusted Gross Income", path: ["Adjusted_Gross_Income"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-999999999","max":"9999999999"},
    ],
    note: [
        "-999999999 to 9999999999",
        "Blank"
    ]};

export const field_885 = {len: 2, pos_start: 7224, pos_end: 7226,
    idx: 885, name: "Number of exemptions", path: ["Number_of_exemptions"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99"},
    ],
    note: [
        "0 to 99",
        "Blank"
    ]};

export const field_886 = {len: 2, pos_start: 7226, pos_end: 7228,
    idx: 886, name: "Number of dependents", path: ["Number_of_dependents"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99"},
    ],
    note: [
        "0 to 99",
        "Blank"
    ]};

export const field_887 = {len: 11, pos_start: 7228, pos_end: 7239,
    idx: 887, name: "Total income earned amount", path: ["Total_income_earned_amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_888 = {len: 9, pos_start: 7239, pos_end: 7248,
    idx: 888, name: "Total tax paid amount", path: ["Total_tax_paid_amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999"},
    ],
    note: [
        "0 to 999999999",
        "Blank"
    ]};

export const field_889 = {len: 9, pos_start: 7248, pos_end: 7257,
    idx: 889, name: "Educational credits", path: ["Educational_credits"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999"},
    ],
    note: [
        "0 to 999999999",
        "Blank"
    ]};

export const field_890 = {len: 11, pos_start: 7257, pos_end: 7268,
    idx: 890, name: "Untaxed IRA distributions", path: ["Untaxed_IRA_distributions"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_891 = {len: 11, pos_start: 7268, pos_end: 7279,
    idx: 891, name: "IRA deductible and payments", path: ["IRA_deductible_and_payments"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_892 = {len: 11, pos_start: 7279, pos_end: 7290,
    idx: 892, name: "Tax exempt interest", path: ["Tax_exempt_interest"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_893 = {len: 11, pos_start: 7290, pos_end: 7301,
    idx: 893, name: "Untaxed pensions amount", path: ["Untaxed_pensions_amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_894 = {len: 12, pos_start: 7301, pos_end: 7313,
    idx: 894, name: "Schedule C net profit/loss", path: ["Schedule_C_net_profitloss"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-99999999999","max":"99999999999"},
    ],
    note: [
        "-99999999999 to 99999999999",
        "Blank"
    ]};

export const field_895 = {len: 1, pos_start: 7313, pos_end: 7314,
    idx: 895, name: "Schedule A indicator", path: ["Schedule_A_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_896 = {len: 1, pos_start: 7314, pos_end: 7315,
    idx: 896, name: "Schedule B indicator", path: ["Schedule_B_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_897 = {len: 1, pos_start: 7315, pos_end: 7316,
    idx: 897, name: "Schedule D indicator", path: ["Schedule_D_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_898 = {len: 1, pos_start: 7316, pos_end: 7317,
    idx: 898, name: "Schedule E indicator", path: ["Schedule_E_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_899 = {len: 1, pos_start: 7317, pos_end: 7318,
    idx: 899, name: "Schedule F indicator", path: ["Schedule_F_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_900 = {len: 1, pos_start: 7318, pos_end: 7319,
    idx: 900, name: "Schedule H indicator", path: ["Schedule_H_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_901 = {len: 3, pos_start: 7319, pos_end: 7322,
    idx: 901, name: "IRS response code", path: ["IRS_response_code"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "200": "Successful Request",
        "203": "PII Match Failed",
        "206": "Partial Delivery of Content",
        "212": "Cannot Verify Return Data",
        "214": "No Return on File",
      }},
    ],
    note: [
        "200 = Successful Request",
        "203 = PII Match Failed",
        "206 = Partial Delivery of Content",
        "212 = Cannot Verify Return Data",
        "214 = No Return on File"
    ]};


export const section_student_spouse_financial_ftim = /* #__PURE__ */ {
    section: "Student Spouse FTI-M Information",
    path: ["student_spouse","financial_ftim"],
    field_list: [field_882, field_883, field_884, field_885, field_886, field_887, field_888, field_889, field_890, field_891, field_892, field_893, field_894, field_895, field_896, field_897, field_898, field_899, field_900, field_901],
}


//*********************************************
// Section: Parent FTI-M Information
//

export const field_902 = {len: 4, pos_start: 7322, pos_end: 7326,
    idx: 902, name: "Returned tax year", path: ["Returned_tax_year"], 
    validate: _validate_options,
    options: [
      {op: "year", },
    ],
    note: [
        "Year in format: “CCYY”",
        "Blank"
    ]};

export const field_903 = {len: 1, pos_start: 7326, pos_end: 7327,
    idx: 903, name: "Filing status code", path: ["Filing_status_code"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Single",
        "2": "Married–Filed Joint Return",
        "3": "Married–Filed Separate Return",
        "4": "Head of Household",
        "5": "Qualifying Surviving Spouse",
      }},
    ],
    note: [
        "1 = Single",
        "2 = Married–Filed Joint Return",
        "3 = Married–Filed Separate Return",
        "4 = Head of Household",
        "5 = Qualifying Surviving Spouse",
        "Blank"
    ]};

export const field_904 = {len: 10, pos_start: 7327, pos_end: 7337,
    idx: 904, name: "Adjusted Gross Income", path: ["Adjusted_Gross_Income"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-999999999","max":"9999999999"},
    ],
    note: [
        "-999999999 to 9999999999",
        "Blank"
    ]};

export const field_905 = {len: 2, pos_start: 7337, pos_end: 7339,
    idx: 905, name: "Number of exemptions", path: ["Number_of_exemptions"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99"},
    ],
    note: [
        "0 to 99",
        "Blank"
    ]};

export const field_906 = {len: 2, pos_start: 7339, pos_end: 7341,
    idx: 906, name: "Number of dependents", path: ["Number_of_dependents"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99"},
    ],
    note: [
        "0 to 99",
        "Blank"
    ]};

export const field_907 = {len: 11, pos_start: 7341, pos_end: 7352,
    idx: 907, name: "Total income earned amount", path: ["Total_income_earned_amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_908 = {len: 9, pos_start: 7352, pos_end: 7361,
    idx: 908, name: "Total tax paid amount", path: ["Total_tax_paid_amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999"},
    ],
    note: [
        "0 to 999999999",
        "Blank"
    ]};

export const field_909 = {len: 9, pos_start: 7361, pos_end: 7370,
    idx: 909, name: "Educational credits", path: ["Educational_credits"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999"},
    ],
    note: [
        "0 to 999999999",
        "Blank"
    ]};

export const field_910 = {len: 11, pos_start: 7370, pos_end: 7381,
    idx: 910, name: "Untaxed IRA distributions", path: ["Untaxed_IRA_distributions"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_911 = {len: 11, pos_start: 7381, pos_end: 7392,
    idx: 911, name: "IRA deductible and payments", path: ["IRA_deductible_and_payments"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_912 = {len: 11, pos_start: 7392, pos_end: 7403,
    idx: 912, name: "Tax exempt interest", path: ["Tax_exempt_interest"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_913 = {len: 11, pos_start: 7403, pos_end: 7414,
    idx: 913, name: "Untaxed pensions amount", path: ["Untaxed_pensions_amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_914 = {len: 12, pos_start: 7414, pos_end: 7426,
    idx: 914, name: "Schedule C net profit/loss", path: ["Schedule_C_net_profitloss"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-99999999999","max":"99999999999"},
    ],
    note: [
        "-99999999999 to 99999999999",
        "Blank"
    ]};

export const field_915 = {len: 1, pos_start: 7426, pos_end: 7427,
    idx: 915, name: "Schedule A indicator", path: ["Schedule_A_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_916 = {len: 1, pos_start: 7427, pos_end: 7428,
    idx: 916, name: "Schedule B indicator", path: ["Schedule_B_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_917 = {len: 1, pos_start: 7428, pos_end: 7429,
    idx: 917, name: "Schedule D indicator", path: ["Schedule_D_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_918 = {len: 1, pos_start: 7429, pos_end: 7430,
    idx: 918, name: "Schedule E indicator", path: ["Schedule_E_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_919 = {len: 1, pos_start: 7430, pos_end: 7431,
    idx: 919, name: "Schedule F indicator", path: ["Schedule_F_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_920 = {len: 1, pos_start: 7431, pos_end: 7432,
    idx: 920, name: "Schedule H indicator", path: ["Schedule_H_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_921 = {len: 3, pos_start: 7432, pos_end: 7435,
    idx: 921, name: "IRS response code", path: ["IRS_response_code"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "200": "Successful Request",
        "203": "PII Match Failed",
        "206": "Partial Delivery of Content",
        "212": "Cannot Verify Return Data",
        "214": "No Return on File",
      }},
    ],
    note: [
        "200 = Successful Request",
        "203 = PII Match Failed",
        "206 = Partial Delivery of Content",
        "212 = Cannot Verify Return Data",
        "214 = No Return on File"
    ]};


export const section_parent_financial_ftim = /* #__PURE__ */ {
    section: "Parent FTI-M Information",
    path: ["parent","financial_ftim"],
    field_list: [field_902, field_903, field_904, field_905, field_906, field_907, field_908, field_909, field_910, field_911, field_912, field_913, field_914, field_915, field_916, field_917, field_918, field_919, field_920, field_921],
}


//*********************************************
// Section: Parent Spouse or Partner FTI-M Information
//

export const field_922 = {len: 4, pos_start: 7435, pos_end: 7439,
    idx: 922, name: "Returned tax year", path: ["Returned_tax_year"], 
    validate: _validate_options,
    options: [
      {op: "year", },
    ],
    note: [
        "Year in format: “CCYY”",
        "Blank"
    ]};

export const field_923 = {len: 1, pos_start: 7439, pos_end: 7440,
    idx: 923, name: "Filing status code", path: ["Filing_status_code"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Single",
        "2": "Married–Filed Joint Return",
        "3": "Married–Filed Separate Return",
        "4": "Head of Household",
        "5": "Qualifying Surviving Spouse",
      }},
    ],
    note: [
        "1 = Single",
        "2 = Married–Filed Joint Return",
        "3 = Married–Filed Separate Return",
        "4 = Head of Household",
        "5 = Qualifying Surviving Spouse",
        "Blank"
    ]};

export const field_924 = {len: 10, pos_start: 7440, pos_end: 7450,
    idx: 924, name: "Adjusted Gross Income", path: ["Adjusted_Gross_Income"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-999999999","max":"9999999999"},
    ],
    note: [
        "-999999999 to 9999999999",
        "Blank"
    ]};

export const field_925 = {len: 2, pos_start: 7450, pos_end: 7452,
    idx: 925, name: "Number of exemptions", path: ["Number_of_exemptions"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99"},
    ],
    note: [
        "0 to 99",
        "Blank"
    ]};

export const field_926 = {len: 2, pos_start: 7452, pos_end: 7454,
    idx: 926, name: "Number of dependents", path: ["Number_of_dependents"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99"},
    ],
    note: [
        "0 to 99",
        "Blank"
    ]};

export const field_927 = {len: 11, pos_start: 7454, pos_end: 7465,
    idx: 927, name: "Total income earned amount", path: ["Total_income_earned_amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_928 = {len: 9, pos_start: 7465, pos_end: 7474,
    idx: 928, name: "Total tax paid amount", path: ["Total_tax_paid_amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999"},
    ],
    note: [
        "0 to 999999999",
        "Blank"
    ]};

export const field_929 = {len: 9, pos_start: 7474, pos_end: 7483,
    idx: 929, name: "Educational credits", path: ["Educational_credits"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"999999999"},
    ],
    note: [
        "0 to 999999999",
        "Blank"
    ]};

export const field_930 = {len: 11, pos_start: 7483, pos_end: 7494,
    idx: 930, name: "Untaxed IRA distributions", path: ["Untaxed_IRA_distributions"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_931 = {len: 11, pos_start: 7494, pos_end: 7505,
    idx: 931, name: "IRA deductible and payments", path: ["IRA_deductible_and_payments"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_932 = {len: 11, pos_start: 7505, pos_end: 7516,
    idx: 932, name: "Tax exempt interest", path: ["Tax_exempt_interest"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_933 = {len: 11, pos_start: 7516, pos_end: 7527,
    idx: 933, name: "Untaxed pensions amount", path: ["Untaxed_pensions_amount"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"0","max":"99999999999"},
    ],
    note: [
        "0 to 99999999999",
        "Blank"
    ]};

export const field_934 = {len: 12, pos_start: 7527, pos_end: 7539,
    idx: 934, name: "Schedule C net profit/loss", path: ["Schedule_C_net_profitloss"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-99999999999","max":"99999999999"},
    ],
    note: [
        "-99999999999 to 99999999999",
        "Blank"
    ]};

export const field_935 = {len: 1, pos_start: 7539, pos_end: 7540,
    idx: 935, name: "Schedule A indicator", path: ["Schedule_A_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_936 = {len: 1, pos_start: 7540, pos_end: 7541,
    idx: 936, name: "Schedule B indicator", path: ["Schedule_B_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_937 = {len: 1, pos_start: 7541, pos_end: 7542,
    idx: 937, name: "Schedule D indicator", path: ["Schedule_D_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_938 = {len: 1, pos_start: 7542, pos_end: 7543,
    idx: 938, name: "Schedule E indicator", path: ["Schedule_E_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_939 = {len: 1, pos_start: 7543, pos_end: 7544,
    idx: 939, name: "Schedule F indicator", path: ["Schedule_F_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_940 = {len: 1, pos_start: 7544, pos_end: 7545,
    idx: 940, name: "Schedule H indicator", path: ["Schedule_H_indicator"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "1": "Yes",
        "2": "No",
      }},
    ],
    note: [
        "1 = Yes",
        "2 = No",
        "Blank"
    ]};

export const field_941 = {len: 3, pos_start: 7545, pos_end: 7548,
    idx: 941, name: "IRS response code", path: ["IRS_response_code"], 
    validate: _validate_options,
    options: [
      {op: "enum", options: {
        "200": "Successful Request",
        "203": "PII Match Failed",
        "206": "Partial Delivery of Content",
        "212": "Cannot Verify Return Data",
        "214": "No Return on File",
      }},
    ],
    note: [
        "200 = Successful Request",
        "203 = PII Match Failed",
        "206 = Partial Delivery of Content",
        "212 = Cannot Verify Return Data",
        "214 = No Return on File"
    ]};

export const field_942 = {len: 11, pos_start: 7548, pos_end: 7559,
    idx: 942, name: null, 
    validate: _validate_expect,
    expect: "CUI//SP-TAX", non_content: true,
    note: [
        "Exact string: “CUI//SP-TAX”"
    ]};

export const field_943 = {len: 50, pos_start: 7559, pos_end: 7609,
    idx: 943, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};


export const section_parent_spouse_financial_ftim = /* #__PURE__ */ {
    section: "Parent Spouse or Partner FTI-M Information",
    path: ["parent_spouse","financial_ftim"],
    field_list: [field_922, field_923, field_924, field_925, field_926, field_927, field_928, field_929, field_930, field_931, field_932, field_933, field_934, field_935, field_936, field_937, field_938, field_939, field_940, field_941, field_942, field_943],
}


//*********************************************
// Section: Total Income Information
//

export const field_944 = {len: 15, pos_start: 7609, pos_end: 7624,
    idx: 944, name: "Student total income", path: ["Student"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-99999999999999","max":"999999999999999"},
    ],
    note: [
        "-99999999999999 to 999999999999999",
        "Blank"
    ]};

export const field_945 = {len: 15, pos_start: 7624, pos_end: 7639,
    idx: 945, name: "Parent total income", path: ["Parent"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-99999999999999","max":"999999999999999"},
    ],
    note: [
        "-99999999999999 to 999999999999999",
        "Blank"
    ]};

export const field_946 = {len: 15, pos_start: 7639, pos_end: 7654,
    idx: 946, name: "FISAP total income", path: ["FISAP"], 
    validate: _validate_options,
    options: [
      {op: "range", "min":"-99999999999999","max":"999999999999999"},
    ],
    note: [
        "-99999999999999 to 999999999999999",
        "Blank"
    ]};

export const field_947 = {len: 50, pos_start: 7654, pos_end: 7704,
    idx: 947, name: null, 
    extra: "Filler",
    non_content: true, 
    note: [
        "For Federal Student Aid use only"
    ]};


export const section_total_income = /* #__PURE__ */ {
    section: "Total Income Information",
    path: ["total_income"],
    field_list: [field_944, field_945, field_946, field_947],
}


//*********************************************
// ISIR record
//

export const isir_record_fields = /* #__PURE__ */ [, field_1, field_2, field_3, field_4, field_5, field_6, field_7, field_8, field_9, field_10, field_11, field_12, field_13, field_14, field_15, field_16, field_17, field_18, field_19, field_20, field_21, field_22, field_23, field_24, field_25, field_26, field_27, field_28, field_29, field_30, field_31, field_32, field_33, field_34, field_35, field_36, field_37, field_38, field_39, field_40, field_41, field_42, field_43, field_44, field_45, field_46, field_47, field_48, field_49, field_50, field_51, field_52, field_53, field_54, field_55, field_56, field_57, field_58, field_59, field_60, field_61, field_62, field_63, field_64, field_65, field_66, field_67, field_68, field_69, field_70, field_71, field_72, field_73, field_74, field_75, field_76, field_77, field_78, field_79, field_80, field_81, field_82, field_83, field_84, field_85, field_86, field_87, field_88, field_89, field_90, field_91, field_92, field_93, field_94, field_95, field_96, field_97, field_98, field_99, field_100, field_101, field_102, field_103, field_104, field_105, field_106, field_107, field_108, field_109, field_110, field_111, field_112, field_113, field_114, field_115, field_116, field_117, field_118, field_119, field_120, field_121, field_122, field_123, field_124, field_125, field_126, field_127, field_128, field_129, field_130, field_131, field_132, field_133, field_134, field_135, field_136, field_137, field_138, field_139, field_140, field_141, field_142, field_143, field_144, field_145, field_146, field_147, field_148, field_149, field_150, field_151, field_152, field_153, field_154, field_155, field_156, field_157, field_158, field_159, field_160, field_161, field_162, field_163, field_164, field_165, field_166, field_167, field_168, field_169, field_170, field_171, field_172, field_173, field_174, field_175, field_176, field_177, field_178, field_179, field_180, field_181, field_182, field_183, field_184, field_185, field_186, field_187, field_188, field_189, field_190, field_191, field_192, field_193, field_194, field_195, field_196, field_197, field_198, field_199, field_200, field_201, field_202, field_203, field_204, field_205, field_206, field_207, field_208, field_209, field_210, field_211, field_212, field_213, field_214, field_215, field_216, field_217, field_218, field_219, field_220, field_221, field_222, field_223, field_224, field_225, field_226, field_227, field_228, field_229, field_230, field_231, field_232, field_233, field_234, field_235, field_236, field_237, field_238, field_239, field_240, field_241, field_242, field_243, field_244, field_245, field_246, field_247, field_248, field_249, field_250, field_251, field_252, field_253, field_254, field_255, field_256, field_257, field_258, field_259, field_260, field_261, field_262, field_263, field_264, field_265, field_266, field_267, field_268, field_269, field_270, field_271, field_272, field_273, field_274, field_275, field_276, field_277, field_278, field_279, field_280, field_281, field_282, field_283, field_284, field_285, field_286, field_287, field_288, field_289, field_290, field_291, field_292, field_293, field_294, field_295, field_296, field_297, field_298, field_299, field_300, field_301, field_302, field_303, field_304, field_305, field_306, field_307, field_308, field_309, field_310, field_311, field_312, field_313, field_314, field_315, field_316, field_317, field_318, field_319, field_320, field_321, field_322, field_323, field_324, field_325, field_326, field_327, field_328, field_329, field_330, field_331, field_332, field_333, field_334, field_335, field_336, field_337, field_338, field_339, field_340, field_341, field_342, field_343, field_344, field_345, field_346, field_347, field_348, field_349, field_350, field_351, field_352, field_353, field_354, field_355, field_356, field_357, field_358, field_359, field_360, field_361, field_362, field_363, field_364, field_365, field_366, field_367, field_368, field_369, field_370, field_371, field_372, field_373, field_374, field_375, field_376, field_377, field_378, field_379, field_380, field_381, field_382, field_383, field_384, field_385, field_386, field_387, field_388, field_389, field_390, field_391, field_392, field_393, field_394, field_395, field_396, field_397, field_398, field_399, field_400, field_401, field_402, field_403, field_404, field_405, field_406, field_407, field_408, field_409, field_410, field_411, field_412, field_413, field_414, field_415, field_416, field_417, field_418, field_419, field_420, field_421, field_422, field_423, field_424, field_425, field_426, field_427, field_428, field_429, field_430, field_431, field_432, field_433, field_434, field_435, field_436, field_437, field_438, field_439, field_440, field_441, field_442, field_443, field_444, field_445, field_446, field_447, field_448, field_449, field_450, field_451, field_452, field_453, field_454, field_455, field_456, field_457, field_458, field_459, field_460, field_461, field_462, field_463, field_464, field_465, field_466, field_467, field_468, field_469, field_470, field_471, field_472, field_473, field_474, field_475, field_476, field_477, field_478, field_479, field_480, field_481, field_482, field_483, field_484, field_485, field_486, field_487, field_488, field_489, field_490, field_491, field_492, field_493, field_494, field_495, field_496, field_497, field_498, field_499, field_500, field_501, field_502, field_503, field_504, field_505, field_506, field_507, field_508, field_509, field_510, field_511, field_512, field_513, field_514, field_515, field_516, field_517, field_518, field_519, field_520, field_521, field_522, field_523, field_524, field_525, field_526, field_527, field_528, field_529, field_530, field_531, field_532, field_533, field_534, field_535, field_536, field_537, field_538, field_539, field_540, field_541, field_542, field_543, field_544, field_545, field_546, field_547, field_548, field_549, field_550, field_551, field_552, field_553, field_554, field_555, field_556, field_557, field_558, field_559, field_560, field_561, field_562, field_563, field_564, field_565, field_566, field_567, field_568, field_569, field_570, field_571, field_572, field_573, field_574, field_575, field_576, field_577, field_578, field_579, field_580, field_581, field_582, field_583, field_584, field_585, field_586, field_587, field_588, field_589, field_590, field_591, field_592, field_593, field_594, field_595, field_596, field_597, field_598, field_599, field_600, field_601, field_602, field_603, field_604, field_605, field_606, field_607, field_608, field_609, field_610, field_611, field_612, field_613, field_614, field_615, field_616, field_617, field_618, field_619, field_620, field_621, field_622, field_623, field_624, field_625, field_626, field_627, field_628, field_629, field_630, field_631, field_632, field_633, field_634, field_635, field_636, field_637, field_638, field_639, field_640, field_641, field_642, field_643, field_644, field_645, field_646, field_647, field_648, field_649, field_650, field_651, field_652, field_653, field_654, field_655, field_656, field_657, field_658, field_659, field_660, field_661, field_662, field_663, field_664, field_665, field_666, field_667, field_668, field_669, field_670, field_671, field_672, field_673, field_674, field_675, field_676, field_677, field_678, field_679, field_680, field_681, field_682, field_683, field_684, field_685, field_686, field_687, field_688, field_689, field_690, field_691, field_692, field_693, field_694, field_695, field_696, field_697, field_698, field_699, field_700, field_701, field_702, field_703, field_704, field_705, field_706, field_707, field_708, field_709, field_710, field_711, field_712, field_713, field_714, field_715, field_716, field_717, field_718, field_719, field_720, field_721, field_722, field_723, field_724, field_725, field_726, field_727, field_728, field_729, field_730, field_731, field_732, field_733, field_734, field_735, field_736, field_737, field_738, field_739, field_740, field_741, field_742, field_743, field_744, field_745, field_746, field_747, field_748, field_749, field_750, field_751, field_752, field_753, field_754, field_755, field_756, field_757, field_758, field_759, field_760, field_761, field_762, field_763, field_764, field_765, field_766, field_767, field_768, field_769, field_770, field_771, field_772, field_773, field_774, field_775, field_776, field_777, field_778, field_779, field_780, field_781, field_782, field_783, field_784, field_785, field_786, field_787, field_788, field_789, field_790, field_791, field_792, field_793, field_794, field_795, field_796, field_797, field_798, field_799, field_800, field_801, field_802, field_803, field_804, field_805, field_806, field_807, field_808, field_809, field_810, field_811, field_812, field_813, field_814, field_815, field_816, field_817, field_818, field_819, field_820, field_821, field_822, field_823, field_824, field_825, field_826, field_827, field_828, field_829, field_830, field_831, field_832, field_833, field_834, field_835, field_836, field_837, field_838, field_839, field_840, field_841, field_842, field_843, field_844, field_845, field_846, field_847, field_848, field_849, field_850, field_851, field_852, field_853, field_854, field_855, field_856, field_857, field_858, field_859, field_860, field_861, field_862, field_863, field_864, field_865, field_866, field_867, field_868, field_869, field_870, field_871, field_872, field_873, field_874, field_875, field_876, field_877, field_878, field_879, field_880, field_881, field_882, field_883, field_884, field_885, field_886, field_887, field_888, field_889, field_890, field_891, field_892, field_893, field_894, field_895, field_896, field_897, field_898, field_899, field_900, field_901, field_902, field_903, field_904, field_905, field_906, field_907, field_908, field_909, field_910, field_911, field_912, field_913, field_914, field_915, field_916, field_917, field_918, field_919, field_920, field_921, field_922, field_923, field_924, field_925, field_926, field_927, field_928, field_929, field_930, field_931, field_932, field_933, field_934, field_935, field_936, field_937, field_938, field_939, field_940, field_941, field_942, field_943, field_944, field_945, field_946, field_947];

export const isir_record_sections = /* #__PURE__ */ [section_transaction, section_student_identity, section_student_non_financial, section_student_demographic, section_student_financial_manual, section_student_schools, section_student_consent, section_student_spouse_identity, section_student_spouse_financial_manual, section_student_spouse_consent, section_parent_identity, section_parent_non_financial, section_parent_financial_manual, section_parent_consent, section_parent_spouse_identity, section_parent_spouse_financial_manual, section_parent_spouse_consent, section_preparer, section_FPS, section_correction, section_matches, section_NSLDS, section_FTIM, section_student_financial_ftim, section_student_spouse_financial_ftim, section_parent_financial_ftim, section_parent_spouse_financial_ftim, section_total_income];


export const isir_module = (namespace=(globalThis.isir_module={})) =>
    Object.assign(namespace, {
      isir_field_read_raw, isir_field_read, isir_field_validate,
      isir_field_update_raw, isir_field_update, _isir_field_pack_value, _isir_field_raw_splice,
      isir_blank, isir_model_from,
      isir_load_report, isir_section_report,
      isir_load_json, isir_section_json,
      isir_record_sections, isir_record_fields,
      section_transaction, section_student_identity, section_student_non_financial, section_student_demographic, section_student_financial_manual, section_student_schools, section_student_consent, section_student_spouse_identity, section_student_spouse_financial_manual, section_student_spouse_consent, section_parent_identity, section_parent_non_financial, section_parent_financial_manual, section_parent_consent, section_parent_spouse_identity, section_parent_spouse_financial_manual, section_parent_spouse_consent, section_preparer, section_FPS, section_correction, section_matches, section_NSLDS, section_FTIM, section_student_financial_ftim, section_student_spouse_financial_ftim, section_parent_financial_ftim, section_parent_spouse_financial_ftim, section_total_income,
      field_1, field_2, field_3, field_4, field_5, field_6, field_7, field_8, field_9, field_10, field_11, field_12, field_13, field_14, field_15, field_16, field_17, field_18, field_19, field_20, field_21, field_22, field_23, field_24, field_25, field_26, field_27, field_28, field_29, field_30, field_31, field_32, field_33, field_34, field_35, field_36, field_37, field_38, field_39, field_40, field_41, field_42, field_43, field_44, field_45, field_46, field_47, field_48, field_49, field_50, field_51, field_52, field_53, field_54, field_55, field_56, field_57, field_58, field_59, field_60, field_61, field_62, field_63, field_64, field_65, field_66, field_67, field_68, field_69, field_70, field_71, field_72, field_73, field_74, field_75, field_76, field_77, field_78, field_79, field_80, field_81, field_82, field_83, field_84, field_85, field_86, field_87, field_88, field_89, field_90, field_91, field_92, field_93, field_94, field_95, field_96, field_97, field_98, field_99, field_100, field_101, field_102, field_103, field_104, field_105, field_106, field_107, field_108, field_109, field_110, field_111, field_112, field_113, field_114, field_115, field_116, field_117, field_118, field_119, field_120, field_121, field_122, field_123, field_124, field_125, field_126, field_127, field_128, field_129, field_130, field_131, field_132, field_133, field_134, field_135, field_136, field_137, field_138, field_139, field_140, field_141, field_142, field_143, field_144, field_145, field_146, field_147, field_148, field_149, field_150, field_151, field_152, field_153, field_154, field_155, field_156, field_157, field_158, field_159, field_160, field_161, field_162, field_163, field_164, field_165, field_166, field_167, field_168, field_169, field_170, field_171, field_172, field_173, field_174, field_175, field_176, field_177, field_178, field_179, field_180, field_181, field_182, field_183, field_184, field_185, field_186, field_187, field_188, field_189, field_190, field_191, field_192, field_193, field_194, field_195, field_196, field_197, field_198, field_199, field_200, field_201, field_202, field_203, field_204, field_205, field_206, field_207, field_208, field_209, field_210, field_211, field_212, field_213, field_214, field_215, field_216, field_217, field_218, field_219, field_220, field_221, field_222, field_223, field_224, field_225, field_226, field_227, field_228, field_229, field_230, field_231, field_232, field_233, field_234, field_235, field_236, field_237, field_238, field_239, field_240, field_241, field_242, field_243, field_244, field_245, field_246, field_247, field_248, field_249, field_250, field_251, field_252, field_253, field_254, field_255, field_256, field_257, field_258, field_259, field_260, field_261, field_262, field_263, field_264, field_265, field_266, field_267, field_268, field_269, field_270, field_271, field_272, field_273, field_274, field_275, field_276, field_277, field_278, field_279, field_280, field_281, field_282, field_283, field_284, field_285, field_286, field_287, field_288, field_289, field_290, field_291, field_292, field_293, field_294, field_295, field_296, field_297, field_298, field_299, field_300, field_301, field_302, field_303, field_304, field_305, field_306, field_307, field_308, field_309, field_310, field_311, field_312, field_313, field_314, field_315, field_316, field_317, field_318, field_319, field_320, field_321, field_322, field_323, field_324, field_325, field_326, field_327, field_328, field_329, field_330, field_331, field_332, field_333, field_334, field_335, field_336, field_337, field_338, field_339, field_340, field_341, field_342, field_343, field_344, field_345, field_346, field_347, field_348, field_349, field_350, field_351, field_352, field_353, field_354, field_355, field_356, field_357, field_358, field_359, field_360, field_361, field_362, field_363, field_364, field_365, field_366, field_367, field_368, field_369, field_370, field_371, field_372, field_373, field_374, field_375, field_376, field_377, field_378, field_379, field_380, field_381, field_382, field_383, field_384, field_385, field_386, field_387, field_388, field_389, field_390, field_391, field_392, field_393, field_394, field_395, field_396, field_397, field_398, field_399, field_400, field_401, field_402, field_403, field_404, field_405, field_406, field_407, field_408, field_409, field_410, field_411, field_412, field_413, field_414, field_415, field_416, field_417, field_418, field_419, field_420, field_421, field_422, field_423, field_424, field_425, field_426, field_427, field_428, field_429, field_430, field_431, field_432, field_433, field_434, field_435, field_436, field_437, field_438, field_439, field_440, field_441, field_442, field_443, field_444, field_445, field_446, field_447, field_448, field_449, field_450, field_451, field_452, field_453, field_454, field_455, field_456, field_457, field_458, field_459, field_460, field_461, field_462, field_463, field_464, field_465, field_466, field_467, field_468, field_469, field_470, field_471, field_472, field_473, field_474, field_475, field_476, field_477, field_478, field_479, field_480, field_481, field_482, field_483, field_484, field_485, field_486, field_487, field_488, field_489, field_490, field_491, field_492, field_493, field_494, field_495, field_496, field_497, field_498, field_499, field_500, field_501, field_502, field_503, field_504, field_505, field_506, field_507, field_508, field_509, field_510, field_511, field_512, field_513, field_514, field_515, field_516, field_517, field_518, field_519, field_520, field_521, field_522, field_523, field_524, field_525, field_526, field_527, field_528, field_529, field_530, field_531, field_532, field_533, field_534, field_535, field_536, field_537, field_538, field_539, field_540, field_541, field_542, field_543, field_544, field_545, field_546, field_547, field_548, field_549, field_550, field_551, field_552, field_553, field_554, field_555, field_556, field_557, field_558, field_559, field_560, field_561, field_562, field_563, field_564, field_565, field_566, field_567, field_568, field_569, field_570, field_571, field_572, field_573, field_574, field_575, field_576, field_577, field_578, field_579, field_580, field_581, field_582, field_583, field_584, field_585, field_586, field_587, field_588, field_589, field_590, field_591, field_592, field_593, field_594, field_595, field_596, field_597, field_598, field_599, field_600, field_601, field_602, field_603, field_604, field_605, field_606, field_607, field_608, field_609, field_610, field_611, field_612, field_613, field_614, field_615, field_616, field_617, field_618, field_619, field_620, field_621, field_622, field_623, field_624, field_625, field_626, field_627, field_628, field_629, field_630, field_631, field_632, field_633, field_634, field_635, field_636, field_637, field_638, field_639, field_640, field_641, field_642, field_643, field_644, field_645, field_646, field_647, field_648, field_649, field_650, field_651, field_652, field_653, field_654, field_655, field_656, field_657, field_658, field_659, field_660, field_661, field_662, field_663, field_664, field_665, field_666, field_667, field_668, field_669, field_670, field_671, field_672, field_673, field_674, field_675, field_676, field_677, field_678, field_679, field_680, field_681, field_682, field_683, field_684, field_685, field_686, field_687, field_688, field_689, field_690, field_691, field_692, field_693, field_694, field_695, field_696, field_697, field_698, field_699, field_700, field_701, field_702, field_703, field_704, field_705, field_706, field_707, field_708, field_709, field_710, field_711, field_712, field_713, field_714, field_715, field_716, field_717, field_718, field_719, field_720, field_721, field_722, field_723, field_724, field_725, field_726, field_727, field_728, field_729, field_730, field_731, field_732, field_733, field_734, field_735, field_736, field_737, field_738, field_739, field_740, field_741, field_742, field_743, field_744, field_745, field_746, field_747, field_748, field_749, field_750, field_751, field_752, field_753, field_754, field_755, field_756, field_757, field_758, field_759, field_760, field_761, field_762, field_763, field_764, field_765, field_766, field_767, field_768, field_769, field_770, field_771, field_772, field_773, field_774, field_775, field_776, field_777, field_778, field_779, field_780, field_781, field_782, field_783, field_784, field_785, field_786, field_787, field_788, field_789, field_790, field_791, field_792, field_793, field_794, field_795, field_796, field_797, field_798, field_799, field_800, field_801, field_802, field_803, field_804, field_805, field_806, field_807, field_808, field_809, field_810, field_811, field_812, field_813, field_814, field_815, field_816, field_817, field_818, field_819, field_820, field_821, field_822, field_823, field_824, field_825, field_826, field_827, field_828, field_829, field_830, field_831, field_832, field_833, field_834, field_835, field_836, field_837, field_838, field_839, field_840, field_841, field_842, field_843, field_844, field_845, field_846, field_847, field_848, field_849, field_850, field_851, field_852, field_853, field_854, field_855, field_856, field_857, field_858, field_859, field_860, field_861, field_862, field_863, field_864, field_865, field_866, field_867, field_868, field_869, field_870, field_871, field_872, field_873, field_874, field_875, field_876, field_877, field_878, field_879, field_880, field_881, field_882, field_883, field_884, field_885, field_886, field_887, field_888, field_889, field_890, field_891, field_892, field_893, field_894, field_895, field_896, field_897, field_898, field_899, field_900, field_901, field_902, field_903, field_904, field_905, field_906, field_907, field_908, field_909, field_910, field_911, field_912, field_913, field_914, field_915, field_916, field_917, field_918, field_919, field_920, field_921, field_922, field_923, field_924, field_925, field_926, field_927, field_928, field_929, field_930, field_931, field_932, field_933, field_934, field_935, field_936, field_937, field_938, field_939, field_940, field_941, field_942, field_943, field_944, field_945, field_946, field_947,
    })

//***********************************************
//* END TRANSPILED SECTION **********************
//***********************************************
