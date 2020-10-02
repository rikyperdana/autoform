var m, _, afState = {arrLen: {}, form: {}}

function autoForm(opts){return {view: function(){
  function normal(name){return name.replace(/\d/g, '$')}
  function withThis(obj, cb){return cb(obj)}
  function ors(array){return array.find(Boolean)}
  function dateValue(timestamp, hour){
    var date = new Date(timestamp),
    zeros = function(num){return num < 10 ? '0'+num : ''+num},
    dateStamp = [
      date.getFullYear(),
      zeros(date.getMonth()+1),
      zeros(date.getDate())
    ].join('-'),
    hourStamp = 'T'+zeros(date.getHours())+':'+zeros(date.getMinutes())
    return !hour ? dateStamp : dateStamp+hourStamp
  }

  function linearize(obj){
    function recurse(doc){
      var value = doc[_.keys(doc)[0]]
      return typeof(value) === 'object' ? _.map(value, function(val, key){
        return recurse({[_.keys(doc)[0]+'.'+key]: val})
      }) : doc
    }
    return _.fromPairs(
      _.flattenDeep(recurse({doc: obj}))
      .map(function(i){return [_.keys(i)[0].substr(4), _.values(i)[0]]})
    )
  }

  afState.form[opts.id] = opts.doc ?
    linearize(opts.doc) : afState.form[opts.id]

  var attr = {
    form: {
      id: opts.id,
      oncreate: opts.oncreate,
      onchange: function(e){
        e.redraw = false
        afState.form[opts.id] = afState.form[opts.id] || {}
        afState.form[opts.id][e.target.name] = e.target.value
      },
      onsubmit: function(e){
        e.preventDefault()
        afState.form[opts.id] = opts.autoReset && null
        var submit = () => opts.action(
          _.filter(e.target, function(i){return i.name && i.value})
          .map(function(obj){
            var type = opts.schema[normal(obj.name)].type
            return _.reduceRight(
              obj.name.split('.'),
              function(res, inc){return {[inc]: res}},
              obj.value && [ // value conversion
                ((type === String) && obj.value),
                ((type === Number) && +(obj.value)),
                ((type === Date) && (new Date(obj.value)).getTime())
              ].filter(function(i){return !!i})[0]
            )
          }).reduce(function(res, inc){
            function recursive(inc){return ors([
              typeof(inc) === 'object' && ors([
                +_.keys(inc)[0]+1 &&
                _.range(+_.keys(inc)[0]+1).map(function(i){
                  return i === +_.keys(inc)[0] ?
                  recursive(_.values(inc)[0]) : undefined
                }),
                {[_.keys(inc)[0]]: recursive(_.values(inc)[0])}
              ]), inc
            ])}
            return _.merge(res, recursive(inc))
          }, {})
        )
        !opts.confirmMessage ? submit()
        : confirm(opts.confirmMessage) && submit()
      }
    },
    arrLen: function(name, type){return {onclick: function(){
      afState.arrLen[name] = _.get(afState.arrLen, name) || 0
      var dec = afState.arrLen[name] > 0 ? -1 : 0
      afState.arrLen[name] += ({inc: 1, dec})[type]
    }}},
    label: function(name, schema){return m('label.label',
      m('span', schema.label || _.startCase(
       name.split('.').map(i => +i+1 ? +i+1 : i).join('.')
      )),
      m('span', m('b.has-text-danger', !schema.optional && ' *'))
    )}
  }

  function inputTypes(name, schema){return {
    hidden: function(){return m('input.input', {
      type: 'hidden', name: !schema.exclude ? name : '',
      value: schema.autoValue &&
        schema.autoValue(name, afState.form[opts.id], opts)
    })},
    readonly: function(){return m('.field',
      attr.label(name, schema),
      m('input.input', {
        readonly: true, name: !schema.exclude ? name : '', disabled: true,
        value: schema.autoValue(name, afState.form[opts.id], opts)
      }),
      m('p.help', _.get(schema, 'autoform.help'))
    )},
    "datetime-local": function(){return m('.field',
      attr.label(name, schema),
      m('.control', m('input.input', {
        type: 'datetime-local',
        name: !schema.exclude ? name: '',
        required: !schema.optional,
        value: dateValue(_.get(afState.form, [opts.id, name]), true),
        onchange: schema.autoRedraw && function(){}
      })),
      m('p.help', _.get(schema, 'autoform.help'))
    )},
    textarea: function(){return m('.field',
      attr.label(name, schema),
      m('textarea.textarea', {
        name: !schema.exclude ? name : '',
        required: !schema.optional,
        value: _.get(afState.form, [opts.id, name]),
        placeholder: _.get(schema, 'autoform.placeholder'),
        rows: _.get(schema, 'autoform.rows') || 6,
        onchange: schema.autoRedraw && function(){}
      }),
      m('p.help', _.get(schema, 'autoform.help'))
    )},
    password: function(){return m('.field',
      attr.label(name, schema), m('input.input', {
        name: !schema.exclude ? name : '', pattern: schema.regExp,
        required: !schema.optional, type: 'password',
        placeholder: _.get(schema, 'autoform.placeholder'),
        onchange: schema.autoRedraw && function(){}
      }),
      m('p.help', _.get(schema, 'autoform.help'))
    )},
    select: function(){return m('.field.is-expanded',
      attr.label(name, schema),
      m('.select.is-fullwidth', m('select',
        {
          name: !schema.exclude ? name : '',
          required: !schema.optional,
          value: _.get(afState.form, [opts.id, name]),
          onchange: schema.autoRedraw && function(){}
        },
        m('option', {value: ''}, '-'),
        schema.autoform.options(name, afState.form[opts.id])
        .map(function(i){return m('option', {
          value: i.value,
          selected: !!_.get(afState.form, [opts.id, name])
        }, i.label)})
      )),
      m('p.help', _.get(schema, 'autoform.help'))
    )},
    standard: function(){return ors([
      schema.type === Object && m('.box',
        attr.label(name, schema),
        withThis(
          _.map(opts.schema, function(val, key){
            return _.merge(val, {name: key})
          }).filter(function(i){
            function getLen(str){return _.size(_.split(str, '.'))};
            return _.every([
              _.includes(i.name, normal(name)+'.'),
              getLen(name)+1 === getLen(i.name)
            ])
          }).map(function(i){
            var childSchema = opts.schema[normal(i.name)],
            fieldName = name+'.'+_.last(i.name.split('.'))
            return {
              [fieldName]: () => inputTypes(fieldName, childSchema)[
                _.get(childSchema, 'autoform.type') || 'standard'
              ]()
            }
          }),
          fields =>
            _.get(opts.arangement, name) ?
            opts.arangement[name].map(i => m('.columns',
              i.map(j => m('.column',
                fields.find(k => k[name+'.'+j])[name+'.'+j]()
              ))
            )) : fields.map(i => _.values(i)[0]())
        ),
        m('p.help', _.get(schema, 'autoform.help'))
      ),

      schema.type === Array && m('.box',
        attr.label(name, schema),
        !schema.fixed && m('.tags',
          m('.tag.is-success', attr.arrLen(name, 'inc'), 'Add+'),
          m('.tag.is-warning', attr.arrLen(name, 'dec'), 'Rem-'),
          m('.tag', afState.arrLen[name]),
        ),
        _.range(
          _.get(opts.doc, name) && opts.doc[name].length,
          afState.arrLen[name]
        ).map(function(i){
          var childSchema = opts.schema[normal(name)+'.$']
          return inputTypes(name+'.'+i, childSchema)
          [_.get(childSchema, 'autoform.type') || 'standard']()
        }),
        m('p.help', _.get(schema, 'autoform.help'))
      ),

      m('.field',
        attr.label(name, schema),
        m('.control', m('input.input', {
          step: 'any', name: !schema.exclude ? name : '',
          placeholder: _.get(schema, 'autoform.placeholder'),
          value: ors([
            schema.autoValue &&
            schema.autoValue(name, afState.form[opts.id], opts),
            schema.type === Date &&
            dateValue(_.get(afState.form, [opts.id, name])),
            _.get(afState.form, [opts.id, name])
          ]),
          required: !schema.optional, pattern: schema.regExp,
          min: schema.minMax && schema.minMax(name, afState.form[opts.id])[0],
          max: schema.minMax && schema.minMax(name, afState.form[opts.id])[1],
          onchange: schema.autoRedraw && function(){},
          type: _.get(
            [[Date, 'date'], [String, 'text'], [Number, 'number']]
            .filter(function(i){return i[0] === schema.type})[0], '1'
          ),
        })),
        m('p.help', _.get(schema, 'autoform.help'))
      )
    ])},
  }}

  var fields = _.map(opts.schema, function(val, key){
    return !_.includes(key, '.') && {
      [key]: () => inputTypes(key, val)[
        _.get(val, 'autoform.type') || 'standard'
      ]()
    }
  }).filter(Boolean)

  return m('form', attr.form,
    _.get(opts, 'arangement.top') ?
    opts.arangement.top.map(i => m('.columns', i.map(
      j => m('.column', fields.find(k => k[j])[j]())
    ))) : fields.map(i => Object.values(i)[0]()),
    m('.row', m('button.button',
      _.assign({type: 'submit', class: 'is-info'}, opts.submit),
      (opts.submit && opts.submit.value) || 'Submit'
    ))
  )
}}}
